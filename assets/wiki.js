/*
 * Wiki コア: サイドバー・検索・Markdown表示・ブラウザ上の編集(GitHub連携)・プラグイン読み込み
 *
 * 記法(infobox / [[リンク]] / ||ネタバレ|| など)や目次・最近の更新などの機能は、
 * すべて plugins/ 以下のプラグインです。有効にするものは assets/wiki-data.json の "plugins" で決めます。
 */
(function () {
  "use strict";

  var TOKEN_KEY = "wikiGithubToken";
  var FRESH_MS = 10 * 60 * 1000;
  var SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
  // wiki-data.json に "plugins" が無いときに使うプラグイン(以前は本体に入っていた3つの記法)
  var DEFAULT_PLUGINS = ["infobox", "wikilinks", "spoiler"];
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

  /* =====================================================================
   * プラグイン機構
   *
   * プラグインは plugins/<名前>/plugin.js に置き、次の形で登録します。
   *
   *   Wiki.register("名前", function (api) {
   *     return {
   *       markdown: function (md, ctx) { return md; },      // Markdown本文を変換する
   *       html:     function (el, ctx) {},                  // 描画後のHTML(DOM)を加工する
   *       sidebar:  function (el) {},                       // サイドバーにリンクなどを足す
   *       search:   function (q) { return [{ title, href, note }]; },   // 検索結果を足す(Promiseも可)
   *       editor:   function (ed, ctx) {},                  // 編集画面のツールバーにボタンを足す(ed.onSaved(fn) で保存後の処理も可)
   *       views:    { 名前: { title: "..", render: function (body, ctx) {} } }   // 特別ページ page.html?view=名前
   *     };
   *   });
   *
   * ctx = { page: ページ情報 または null, where: "view"(閲覧) | "preview"(編集中のプレビュー) }
   * 1つのプラグインがエラーを出しても、ほかの機能は止まらず、コンソールに警告が出るだけです。
   * ===================================================================== */
  var factories = {};
  var plugins = [];
  var views = {};
  var cssLoaded = {};
  var cssPromises = [];

  window.Wiki = {
    register: function (name, factory) { factories[name] = factory; }
  };

  function warn(msg, err) {
    if (err !== undefined) console.warn("[wiki] " + msg, err); else console.warn("[wiki] " + msg);
  }

  function normalizePlugins(list) {
    var out = [], seen = {};
    (Array.isArray(list) ? list : DEFAULT_PLUGINS).forEach(function (e) {
      var name = typeof e === "string" ? e : e && e.name;
      var options = (e && typeof e === "object" && e.options && typeof e.options === "object") ? e.options : {};
      if (typeof name !== "string" || !SLUG_RE.test(name)) {
        warn("無効なプラグイン名をスキップしました(半角小文字英数字とハイフンのみ):", e);
        return;
      }
      if (seen[name]) return;
      seen[name] = true;
      out.push({ name: name, options: options });
    });
    return out;
  }

  function loadScript(name) {
    return new Promise(function (resolve) {
      var s = document.createElement("script");
      s.src = "plugins/" + name + "/plugin.js";
      s.onload = function () { resolve(true); };
      s.onerror = function () { warn("プラグインを読み込めませんでした: " + name + "(plugins/" + name + "/plugin.js があるか確認してください)"); resolve(false); };
      document.head.appendChild(s);
    });
  }

  function makeApi(name, options) {
    return {
      name: name,
      options: options,
      pages: function () { return pages; },
      findPage: findPage,
      href: href,
      viewHref: function (v) { return "page.html?view=" + encodeURIComponent(v); },
      esc: esc,
      getText: getText,
      loadCss: function (file) {
        if (!/^[A-Za-z0-9._-]+$/.test(file)) return;
        var key = name + "/" + file;
        if (cssLoaded[key]) return;
        cssLoaded[key] = true;
        cssPromises.push(new Promise(function (resolve) {
          var l = document.createElement("link");
          l.rel = "stylesheet";
          l.href = "plugins/" + name + "/" + file;
          l.onload = l.onerror = function () { resolve(); };
          document.head.appendChild(l);
        }));
      }
    };
  }

  async function loadPlugins(list) {
    var entries = normalizePlugins(list);
    var ok = await Promise.all(entries.map(function (e) { return loadScript(e.name); }));
    // 登録は wiki-data.json の並び順で行う(Markdown変換の順番が決まるため)
    entries.forEach(function (e, i) {
      if (!ok[i]) return;
      var f = factories[e.name];
      if (typeof f !== "function") {
        warn("プラグイン " + e.name + " は Wiki.register(\"" + e.name + "\", ...) を呼んでいません(登録名とフォルダ名を一致させてください)");
        return;
      }
      try {
        var hooks = f(makeApi(e.name, e.options)) || {};
        plugins.push({ name: e.name, hooks: hooks });
        if (hooks.views) Object.keys(hooks.views).forEach(function (k) { views[k] = hooks.views[k]; });
      } catch (err) {
        warn("プラグイン " + e.name + " の初期化でエラー:", err);
      }
    });
    await Promise.all(cssPromises);
  }

  function runHook(name, fn) {
    plugins.forEach(function (p) {
      var h = p.hooks[name];
      if (typeof h !== "function") return;
      try { fn(h); } catch (err) { warn("プラグイン " + p.name + " の " + name + " でエラー:", err); }
    });
  }

  /* ---------- Markdown ---------- */
  // 本文のHTMLは必ずサニタイズする(編集者のトークン保護のため)。ライブラリが無ければ生テキスト表示。
  function render(md, ctx) {
    if (!window.marked || !window.DOMPurify) return "<pre>" + esc(md) + "</pre>";
    runHook("markdown", function (h) {
      var r = h(md, ctx);
      if (typeof r === "string") md = r;
    });
    return window.DOMPurify.sanitize(window.marked.parse(md));
  }
  function enhance(el, ctx) {
    el.querySelectorAll("table").forEach(function (t) { t.classList.add("data"); });
    runHook("html", function (h) { h(el, ctx); });
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
  // ページ本文(Markdown)を取得する。同じページは1回だけ取得して使い回す。取得できなければ空文字。
  var textCache = {};
  function getText(slug) {
    var fresh = freshText(slug);
    if (fresh !== null) return Promise.resolve(fresh);
    if (!textCache[slug]) {
      textCache[slug] = fetch("content/" + encodeURIComponent(slug) + ".md", { cache: "no-cache" })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
        .catch(function () { delete textCache[slug]; return ""; });
    }
    return textCache[slug];
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
    html += '<ul id="results" class="search-results"></ul></div>';
    html += '<div id="side-plugins" class="side-plugins"></div><nav class="nav">';
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

    runHook("sidebar", function (h) { h($("side-plugins")); });

    var lo = $("logout");
    if (lo) lo.addEventListener("click", function (ev) { ev.preventDefault(); setToken(""); location.reload(); });

    var input = $("q"), results = $("results");
    var seq = 0;
    function addResult(title, url, note) {
      var li = document.createElement("li");
      li.innerHTML = '<a href="' + esc(url) + '">' + esc(title) + '<span class="cat">' + esc(note || "") + "</span></a>";
      results.appendChild(li);
    }
    function showNone() {
      results.innerHTML = '<li style="color:var(--muted);font-size:.85rem;padding:6px 8px">見つかりません</li>';
    }
    input.addEventListener("input", function () {
      var raw = input.value.trim(), q = raw.toLowerCase(), my = ++seq;
      results.innerHTML = "";
      if (!q) return;
      var hits = pages.filter(function (p) {
        var hay = (p.title + " " + (p.summary || "") + " " + p.category + " " + (p.keywords || []).join(" ")).toLowerCase();
        return hay.indexOf(q) >= 0;
      });
      hits.forEach(function (p) { addResult(p.title, href(p), p.category); });
      // プラグインの search フック(本文検索など)。タイトルの検索結果の下に足す
      var extras = [];
      runHook("search", function (h) {
        extras.push(Promise.resolve(h(raw)).then(function (r) { return Array.isArray(r) ? r : []; }, function () { return []; }));
      });
      if (!extras.length) { if (!hits.length) showNone(); return; }
      Promise.all(extras).then(function (lists) {
        if (my !== seq) return; // 入力が進んだ後の古い結果は捨てる
        var seen = {}, added = 0;
        hits.forEach(function (p) { seen[href(p)] = true; });
        lists.forEach(function (l) {
          l.forEach(function (it) {
            if (!it || !it.href || seen[it.href]) return;
            seen[it.href] = true;
            addResult(it.title || it.href, it.href, it.note);
            added++;
          });
        });
        if (!hits.length && !added) showNone();
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
      var ctx = { page: page, where: "view" };
      box.innerHTML = head + notice + '<div class="page-body">' + render(md, ctx) + "</div>";
      enhance(box.querySelector(".page-body"), ctx);
    } catch (err) {
      var msg = err.status === 404 && hasRepo()
        ? "このページの本文はまだありません。上の「編集」から書き始められます。"
        : "ページを読み込めませんでした(" + esc(err.message) + ")。ファイルを直接開いている場合は、ローカルサーバー経由で開いてください(README参照)。";
      box.innerHTML = head + notice + '<div class="notice">' + msg + "</div>";
    }
  }

  /* ---------- 特別ページ(プラグインの views) ---------- */
  async function viewSpecial(box, name) {
    var v = views[name];
    if (!v || typeof v.render !== "function") {
      box.innerHTML = '<h1>ページが見つかりません</h1><p><a href="index.html">トップへ戻る</a></p>';
      return;
    }
    var title = v.title || name;
    document.title = title + " - " + (cfg.title || "Wiki");
    box.innerHTML = "<h1>" + esc(title) + '</h1><div class="view-body"></div>';
    try {
      var vb = box.querySelector(".view-body"), vctx = { page: null, where: "view" };
      await v.render(vb, vctx);
      enhance(vb, vctx);
    } catch (err) {
      warn("特別ページ " + name + " の表示でエラー:", err);
      box.querySelector(".view-body").innerHTML = '<div class="notice">このページを表示できませんでした。</div>';
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

  // プラグイン(editor フック)に渡す、ツールバーとテキスト操作の道具
  function makeEditorApi(ta, savedCbs) {
    var bar = $("ed-toolbar");
    function fire() { ta.dispatchEvent(new Event("input")); }
    return {
      textarea: ta,
      // 保存に成功したあとに呼ぶ関数を登録する(下書きの削除など)
      onSaved: function (fn) { savedCbs.push(fn); },
      addButton: function (label, title, onclick) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "tb";
        b.textContent = label;
        b.title = title || label;
        b.addEventListener("click", function () { onclick(); ta.focus(); });
        bar.appendChild(b);
        return b;
      },
      // カーソル位置(選択範囲)を text に置き換える
      insert: function (text) {
        ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, "end");
        fire();
      },
      // 選択範囲を before と after で挟む(未選択なら placeholder を挟んで選択状態にする)
      wrap: function (before, after, placeholder) {
        var s = ta.selectionStart, e = ta.selectionEnd;
        var sel = ta.value.slice(s, e) || placeholder || "";
        ta.setRangeText(before + sel + after, s, e, "end");
        ta.setSelectionRange(s + before.length, s + before.length + sel.length);
        fire();
      }
    };
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
    h += '</div><div id="ed-toolbar" class="ed-toolbar"></div>';
    h += '<div class="ed-grid"><textarea id="ed-text" spellcheck="false"></textarea>';
    h += '<div class="preview"><div class="preview-label">プレビュー</div><div id="ed-preview"></div></div></div>';
    h += '<div class="ed-bar"><input id="ed-msg" type="text" placeholder="変更の要約(省略可)">';
    h += '<button class="btn" id="ed-save" type="button">保存する</button>';
    h += '<a href="' + esc(viewHref) + '">キャンセル</a><span id="ed-status" class="status"></span></div>';
    h += '<p class="meta">記法のヒント: <code>[[ページ名]]</code> でリンク、<code>||ネタバレ||</code> で伏せ字、<code>```infobox</code> で要約欄(それぞれ対応するプラグインが有効なとき)。保存するとGitHubにコミットされ、1〜2分後に公開サイトへ反映されます。</p></div>';
    box.innerHTML = h;

    var ta = $("ed-text"), pv = $("ed-preview"), status = $("ed-status"), saveBtn = $("ed-save");
    ta.value = o.text;
    var pctx = { page: page, where: "preview" };
    var timer = null;
    function refresh() { pv.innerHTML = render(ta.value, pctx); enhance(pv, pctx); }
    ta.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(refresh, 150); });
    refresh();

    var savedCbs = [];
    var ed = makeEditorApi(ta, savedCbs);
    runHook("editor", function (hk) { hk(ed, { page: page, isNew: isNew }); });

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
        savedCbs.forEach(function (fn) { try { fn(slug); } catch (err) { warn("保存後の処理でエラー:", err); } });
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
    if (params.get("view")) return viewSpecial(box, params.get("view"));
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
    await loadPlugins(cfg.plugins);
    applyFreshMeta();
    buildSidebar();
    buildCards();
    route();
  }

  init();
})();