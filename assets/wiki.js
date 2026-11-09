/* Wiki: サイドバー・検索・Markdown表示・ブラウザ上の編集(GitHub連携) */
(function () {
  "use strict";

  var TOKEN_KEY = "wikiGithubToken";
  var FRESH_MS = 10 * 60 * 1000;
  var SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
  var NEW_TEMPLATE =
    "```infobox\n名前\n画像:\n項目1: 内容\n項目2: 内容\n```\n\n" +
    "ここに概要を書きます。\n\n## 見出し\n\n本文。他のページへのリンクは [[ページ名]] と書きます。\n";

  var cfg = { title: "Wiki", repo: "", branch: "main", pages: [] };
  var pages = [];
  var params = new URLSearchParams(location.search);
  var current = params.get("p") || "";

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function href(p) { return "page.html?p=" + encodeURIComponent(p.slug); }
  function bySlug(slug) {
    for (var i = 0; i < pages.length; i++) if (pages[i].slug === slug) return pages[i];
    return null;
  }
  function findPage(key) {
    key = String(key).trim();
    for (var i = 0; i < pages.length; i++) {
      if (pages[i].slug === key || pages[i].title === key) return pages[i];
    }
    return null;
  }
  function hasRepo() { return !!cfg.repo; }
  function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
  function setToken(t) {
    try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }
  function today() {
    var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  /* ---------- Markdown ---------- */
  function preprocess(md) {
    md = md.replace(/```infobox[ \t]*\r?\n([\s\S]*?)```/g, function (_, body) {
      var lines = body.split(/\r?\n/).filter(function (l) { return l.trim() !== ""; });
      if (!lines.length) return "";
      var h = '<div class="infobox"><div class="ib-title">' + esc(lines[0].trim()) + "</div>";
      var rows = "";
      lines.slice(1).forEach(function (l) {
        var m = l.match(/^\s*([^:：]+)[:：]\s*(.*)$/);
        if (!m) return;
        var k = m[1].trim(), v = m[2].trim();
        if (k === "画像") {
          h += v ? '<img src="' + esc(v) + '" alt="">' : '<div class="ib-img">画像</div>';
        } else {
          rows += "<tr><th>" + esc(k) + "</th><td>" + esc(v) + "</td></tr>";
        }
      });
      if (rows) h += "<table>" + rows + "</table>";
      return "\n\n" + h + "</div>\n\n";
    });
    md = md.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, function (_, key, label) {
      var p = findPage(key);
      var text = (label || (p ? p.title : key)).trim();
      return p
        ? '<a href="' + href(p) + '">' + esc(text) + "</a>"
        : '<span class="missing" title="未作成のページ">' + esc(text) + "</span>";
    });
    return md.replace(/\|\|([^|\n]+)\|\|/g, '<span class="spoiler">$1</span>');
  }

  // 本文のHTMLは必ずサニタイズする(編集者のトークン保護のため)。ライブラリが無ければ生テキスト表示。
  function render(md) {
    if (!window.marked || !window.DOMPurify) return "<pre>" + esc(md) + "</pre>";
    return window.DOMPurify.sanitize(window.marked.parse(preprocess(md)));
  }
  function enhance(el) {
    el.querySelectorAll("table").forEach(function (t) {
      if (!t.closest(".infobox")) t.classList.add("data");
    });
    el.querySelectorAll(".spoiler").forEach(function (s) {
      s.addEventListener("click", function () { s.classList.toggle("open"); });
    });
  }

  /* ---------- GitHub API ---------- */
  function b64enc(str) {
    var bytes = new TextEncoder().encode(str), bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64dec(b64) {
    var bin = atob(b64.replace(/\s/g, "")), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  async function gh(method, path, body) {
    var headers = {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + getToken(),
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (body) headers["Content-Type"] = "application/json";
    var r = await fetch("https://api.github.com/repos/" + cfg.repo + path, {
      method: method, headers: headers, body: body ? JSON.stringify(body) : undefined
    });
    var j = {};
    try { j = await r.json(); } catch (e) {}
    if (!r.ok) {
      var err = new Error(j.message || "HTTP " + r.status);
      err.status = r.status;
      throw err;
    }
    return j;
  }
  async function getFile(path) {
    var j = await gh("GET", "/contents/" + path + "?ref=" + encodeURIComponent(cfg.branch));
    return { sha: j.sha, text: b64dec(j.content) };
  }
  function putFile(path, text, sha, message) {
    var b = { message: message, content: b64enc(text), branch: cfg.branch };
    if (sha) b.sha = sha;
    return gh("PUT", "/contents/" + path, b);
  }
  // ページ一覧(wiki-data.json)の更新。他の人の編集と重なったら取り直して再試行する。
  async function updateData(mutate, message) {
    for (var i = 0; i < 3; i++) {
      var d = await getFile("assets/wiki-data.json");
      var data = JSON.parse(d.text);
      mutate(data);
      try {
        return await putFile("assets/wiki-data.json", JSON.stringify(data, null, 2) + "\n", d.sha, message);
      } catch (e) {
        if (e.status !== 409 && e.status !== 422) throw e;
      }
    }
    throw new Error("ページ一覧の更新が他の人の編集と重なりました。少し待ってからもう一度保存してください。");
  }

  /* ---------- 保存直後の表示用(公開サイト反映までの数分間) ---------- */
  function freshSet(slug, text, meta) {
    try {
      var t = Date.now();
      sessionStorage.setItem("wikiFresh:" + slug, JSON.stringify({ t: t, text: text }));
      sessionStorage.setItem("wikiFreshMeta:" + slug, JSON.stringify({ t: t, meta: meta }));
    } catch (e) {}
  }
  function freshText(slug) {
    try {
      var o = JSON.parse(sessionStorage.getItem("wikiFresh:" + slug) || "null");
      if (o && Date.now() - o.t < FRESH_MS) return o.text;
    } catch (e) {}
    return null;
  }
  function applyFreshMeta() {
    try {
      for (var i = 0; i < sessionStorage.length; i++) {
        var k = sessionStorage.key(i);
        if (k.indexOf("wikiFreshMeta:") !== 0) continue;
        var o = JSON.parse(sessionStorage.getItem(k));
        if (!o || Date.now() - o.t > FRESH_MS) continue;
        var slug = k.slice("wikiFreshMeta:".length), p = bySlug(slug);
        if (p) { p.title = o.meta.title; p.category = o.meta.category; p.summary = o.meta.summary; p.updated = o.meta.updated; }
        else pages.push({ slug: slug, title: o.meta.title, category: o.meta.category, summary: o.meta.summary, updated: o.meta.updated, keywords: [] });
      }
    } catch (e) {}
  }

  /* ---------- サイドバー・カード ---------- */
  function buildSidebar() {
    var side = $("sidebar");
    if (!side) return;
    var html = '<p class="site-title"><a href="index.html">' + esc(cfg.title || "Wiki") + "</a></p>";
    html += '<div class="search"><input id="q" type="search" placeholder="ページを検索…" autocomplete="off">';
    html += '<ul id="results" class="search-results"></ul></div><nav class="nav">';
    var cats = [];
    pages.forEach(function (p) { if (cats.indexOf(p.category) < 0) cats.push(p.category); });
    cats.forEach(function (c) {
      html += "<h2>" + esc(c) + "</h2><ul>";
      pages.filter(function (p) { return p.category === c; }).forEach(function (p) {
        var cls = p.slug === current ? ' class="current"' : "";
        html += "<li><a" + cls + ' href="' + href(p) + '">' + esc(p.title) + "</a></li>";
      });
      html += "</ul>";
    });
    html += "</nav>";
    if (hasRepo()) {
      html += '<p class="side-foot"><a href="page.html?new=1">＋ 新しいページを作る</a>';
      if (getToken()) html += '<br><a href="#" id="logout">編集トークンを削除</a>';
      html += "</p>";
    }
    side.innerHTML = html;

    var lo = $("logout");
    if (lo) lo.addEventListener("click", function (ev) { ev.preventDefault(); setToken(""); location.reload(); });

    var input = $("q"), results = $("results");
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      results.innerHTML = "";
      if (!q) return;
      var hits = pages.filter(function (p) {
        var hay = (p.title + " " + (p.summary || "") + " " + p.category + " " + (p.keywords || []).join(" ")).toLowerCase();
        return hay.indexOf(q) >= 0;
      });
      if (!hits.length) {
        results.innerHTML = '<li style="color:var(--muted);font-size:.85rem;padding:6px 8px">見つかりません</li>';
        return;
      }
      hits.forEach(function (p) {
        var li = document.createElement("li");
        li.innerHTML = '<a href="' + href(p) + '">' + esc(p.title) + '<span class="cat">' + esc(p.category) + "</span></a>";
        results.appendChild(li);
      });
    });
  }
  function buildCards() {
    var grid = $("page-cards");
    if (!grid) return;
    grid.innerHTML = pages.map(function (p) {
      return '<a class="card" href="' + href(p) + '"><strong>' + esc(p.title) + "</strong><span>" + esc(p.summary || "") + "</span></a>";
    }).join("");
  }

  /* ---------- 画面部品 ---------- */
  function tabs(page, active) {
    if (!hasRepo()) return "";
    var base = href(page);
    var hist = "https://github.com/" + cfg.repo + "/commits/" + cfg.branch + "/content/" + page.slug + ".md";
    return '<div class="tabs">' +
      '<a class="' + (active === "view" ? "on" : "") + '" href="' + esc(base) + '">閲覧</a>' +
      '<a class="' + (active === "edit" ? "on" : "") + '" href="' + esc(base) + '&edit=1">編集</a>' +
      '<a href="' + esc(hist) + '" target="_blank" rel="noopener">履歴</a></div>';
  }
  function noRepo(box) {
    box.innerHTML = '<h1>編集機能が未設定です</h1><div class="notice">編集機能を使うには、<code>assets/wiki-data.json</code> の <code>"repo"</code> に GitHub のリポジトリ(例: <code>ユーザー名/リポジトリ名</code>)を設定してください。</div>';
  }
  // トークンが無ければ設定画面を出して false を返す
  function needToken(box, title) {
    if (getToken()) return true;
    box.innerHTML = "<h1>" + esc(title) + "</h1>" +
      '<div class="notice"><strong>最初に1回だけ、GitHubのアクセストークンを設定します。</strong>' +
      "<ol>" +
      '<li><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHubのトークン作成ページ</a>を開く(Fine-grained token)</li>' +
      "<li>Repository access で「Only select repositories」→ このwikiのリポジトリを選ぶ</li>" +
      "<li>Permissions → Repository permissions → <strong>Contents</strong> を「Read and write」にする</li>" +
      "<li>発行されたトークンを下に貼り付けて「設定する」</li>" +
      "</ol>トークンはこのブラウザにだけ保存され、GitHub以外には送られません。共用のパソコンでは使わないでください。</div>" +
      '<form id="tk-form" class="tk"><input id="tk" type="password" placeholder="github_pat_..." autocomplete="off"> <button class="btn" type="submit">設定する</button></form>';
    $("tk-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var v = $("tk").value.trim();
      if (!v) return;
      setToken(v);
      location.reload();
    });
    return false;
  }
  function apiErrorMessage(e) {
    if (e.status === 401) {
      setToken("");
      return "トークンが無効か期限切れです。ページを再読み込みして、もう一度設定してください。";
    }
    if (e.status === 403 || e.status === 404) {
      return "GitHubに書き込めません(" + e.message + ")。リポジトリ名、あなたが共同編集者に入っているか、トークンの対象リポジトリと Contents の権限を確認してください。";
    }
    return e.message;
  }

  /* ---------- 閲覧 ---------- */
  async function viewPage(box, page) {
    document.title = page.title + " - " + (cfg.title || "Wiki");
    var head = "<h1>" + esc(page.title) + '</h1><p class="meta"><span class="tag">' + esc(page.category) + "</span>" +
      (page.updated ? " 最終更新: " + esc(page.updated) : "") + "</p>" + tabs(page, "view");
    var notice = params.get("saved")
      ? '<div class="notice">保存しました。公開サイトへの反映には1〜2分かかるため、ほかの人の画面にはしばらく古い内容が出ることがあります。</div>'
      : "";
    box.innerHTML = head + notice + '<p class="meta">読み込み中…</p>';
    try {
      var md = freshText(page.slug);
      if (md === null) {
        var r = await fetch("content/" + page.slug + ".md", { cache: "no-cache" });
        if (!r.ok) { var e = new Error("HTTP " + r.status); e.status = r.status; throw e; }
        md = await r.text();
      }
      box.innerHTML = head + notice + "<div>" + render(md) + "</div>";
      enhance(box);
    } catch (err) {
      var msg = err.status === 404 && hasRepo()
        ? "このページの本文はまだありません。上の「編集」から書き始められます。"
        : "ページを読み込めませんでした(" + esc(err.message) + ")。ファイルを直接開いている場合は、ローカルサーバー経由で開いてください(README参照)。";
      box.innerHTML = head + notice + '<div class="notice">' + msg + "</div>";
    }
  }

  /* ---------- 編集 / 新規作成 ---------- */
  async function viewEdit(box, page) {
    if (!hasRepo()) return noRepo(box);
    if (!needToken(box, page.title + " を編集")) return;
    box.innerHTML = "<h1>" + esc(page.title) + ' を編集</h1><p class="meta">GitHubから最新の内容を読み込み中…</p>';
    try {
      var f;
      try { f = await getFile("content/" + page.slug + ".md"); }
      catch (e) { if (e.status === 404) f = { sha: null, text: "" }; else throw e; }
      buildEditor(box, { isNew: false, page: page, sha: f.sha, text: f.text });
    } catch (e) {
      box.innerHTML = "<h1>" + esc(page.title) + ' を編集</h1><div class="notice">' + esc(apiErrorMessage(e)) + "</div>";
    }
  }
  function viewNew(box) {
    if (!hasRepo()) return noRepo(box);
    if (!needToken(box, "新しいページを作る")) return;
    buildEditor(box, { isNew: true, page: null, slug: params.get("slug") || "", text: NEW_TEMPLATE });
  }

  function buildEditor(box, o) {
    box.classList.add("wide");
    var isNew = o.isNew, page = o.page;
    var cats = [];
    pages.forEach(function (p) { if (cats.indexOf(p.category) < 0) cats.push(p.category); });
    var viewHref = page ? href(page) : "index.html";

    var h = "<h1>" + (isNew ? "新しいページを作る" : esc(page.title) + " を編集") + "</h1>";
    h += isNew ? "" : tabs(page, "edit");
    h += '<div class="editor"><div class="ed-fields">';
    if (isNew) {
      h += '<label>ファイル名(slug)<input id="f-slug" type="text" placeholder="例: new-stage" value="' + esc(o.slug) + '"></label>';
    }
    h += '<label>ページ名<input id="f-title" type="text" value="' + esc(page ? page.title : "") + '"></label>';
    h += '<label>カテゴリ<input id="f-cat" type="text" list="f-cats" value="' + esc(page ? page.category : "") + '"></label>';
    h += '<datalist id="f-cats">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join("") + "</datalist>";
    h += '<label>一言説明<input id="f-sum" type="text" value="' + esc(page ? page.summary || "" : "") + '"></label>';
    h += '</div><div class="ed-grid"><textarea id="ed-text" spellcheck="false"></textarea>';
    h += '<div class="preview"><div class="preview-label">プレビュー</div><div id="ed-preview"></div></div></div>';
    h += '<div class="ed-bar"><input id="ed-msg" type="text" placeholder="変更の要約(省略可)">';
    h += '<button class="btn" id="ed-save" type="button">保存する</button>';
    h += '<a href="' + esc(viewHref) + '">キャンセル</a><span id="ed-status" class="status"></span></div>';
    h += '<p class="meta">記法のヒント: <code>[[ページ名]]</code> でリンク、<code>||ネタバレ||</code> で伏せ字、<code>```infobox</code> で要約欄。保存するとGitHubにコミットされ、1〜2分後に公開サイトへ反映されます。</p></div>';
    box.innerHTML = h;

    var ta = $("ed-text"), pv = $("ed-preview"), status = $("ed-status"), saveBtn = $("ed-save");
    ta.value = o.text;
    var timer = null;
    function refresh() { pv.innerHTML = render(ta.value); enhance(pv); }
    ta.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(refresh, 150); });
    refresh();

    function setStatus(msg, isErr) {
      status.textContent = msg;
      status.className = "status" + (isErr ? " err" : "");
    }

    saveBtn.addEventListener("click", async function () {
      var slug = isNew ? $("f-slug").value.trim() : page.slug;
      var title = $("f-title").value.trim();
      var category = $("f-cat").value.trim() || "未分類";
      var summary = $("f-sum").value.trim();
      var text = ta.value;
      if (isNew && !SLUG_RE.test(slug)) { setStatus("ファイル名は半角の小文字英数字とハイフンだけで入力してください(例: new-stage)", true); return; }
      if (!title) { setStatus("ページ名を入力してください", true); return; }
      var message = $("ed-msg").value.trim() || (isNew ? "ページを追加: " : "ページを編集: ") + title;
      var meta = { title: title, category: category, summary: summary, updated: today() };

      saveBtn.disabled = true;
      setStatus("保存中…", false);
      try {
        if (isNew) {
          var d = await getFile("assets/wiki-data.json");
          var data = JSON.parse(d.text);
          if ((data.pages || []).some(function (x) { return x.slug === slug; })) {
            throw new Error("同じファイル名(slug)のページが既にあります");
          }
          await putFile("content/" + slug + ".md", text, null, message);
          await updateData(function (dd) {
            dd.pages = dd.pages || [];
            if (!dd.pages.some(function (x) { return x.slug === slug; })) {
              dd.pages.push({ slug: slug, title: title, category: category, summary: summary, updated: meta.updated, keywords: [] });
            }
          }, message);
        } else {
          await putFile("content/" + slug + ".md", text, o.sha, message);
          await updateData(function (dd) {
            (dd.pages || []).forEach(function (x) {
              if (x.slug === slug) { x.title = title; x.category = category; x.summary = summary; x.updated = meta.updated; }
            });
          }, message);
        }
        freshSet(slug, text, meta);
        location.href = "page.html?p=" + encodeURIComponent(slug) + "&saved=1";
      } catch (e) {
        saveBtn.disabled = false;
        if (!isNew && (e.status === 409 || e.status === 422)) {
          setStatus("保存できませんでした。ほかの人が先にこのページを更新した可能性があります。編集内容はこの欄に残っているので、コピーしてから、ページを開き直して最新の内容を確認し、もう一度やり直してください。", true);
        } else {
          setStatus("保存に失敗しました: " + apiErrorMessage(e), true);
        }
      }
    });
  }

  /* ---------- ルーティング ---------- */
  function route() {
    var box = $("content");
    if (!box) {
      if (cfg.title) document.title = cfg.title;
      return;
    }
    if (params.get("new")) return viewNew(box);
    var page = bySlug(current) || findPage(current);
    if (!page) {
      var make = hasRepo() && SLUG_RE.test(current)
        ? '<p><a href="page.html?new=1&slug=' + encodeURIComponent(current) + '">このページを作成する</a></p>'
        : "";
      box.innerHTML = '<h1>ページが見つかりません</h1>' + make + '<p><a href="index.html">トップへ戻る</a></p>';
      return;
    }
    if (params.get("edit")) return viewEdit(box, page);
    return viewPage(box, page);
  }

  async function init() {
    try {
      var r = await fetch("assets/wiki-data.json", { cache: "no-cache" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      cfg = await r.json();
    } catch (e) {
      var m = $("content") || document.querySelector("main");
      if (m) m.innerHTML = '<div class="notice">ページ一覧(assets/wiki-data.json)を読み込めませんでした(' + esc(e.message) +
        ")。ファイルを直接開いている場合は、ローカルサーバー経由で開いてください(README参照)。</div>";
      return;
    }
    cfg.repo = cfg.repo || "";
    cfg.branch = cfg.branch || "main";
    pages = cfg.pages || [];
    applyFreshMeta();
    buildSidebar();
    buildCards();
    route();
  }

  window.__wiki = { preprocess: preprocess };
  init();
})();
