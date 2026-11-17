/* 自動生成: tools/build-bundle.py で作られたファイルです。直接は編集しないでください */
/* ===== infobox ===== */
(function () {
/* infobox: ```infobox ブロックを、ページ右上の要約欄に変換する */
Wiki.register("infobox", function (api) {
  api.loadCss("plugin.css");
  return {
    markdown: function (md) {
      return md.replace(/```infobox[ \t]*\r?\n([\s\S]*?)```/g, function (_, body) {
        var lines = body.split(/\r?\n/).filter(function (l) { return l.trim() !== ""; });
        if (!lines.length) return "";
        var h = '<div class="infobox"><div class="ib-title">' + api.esc(lines[0].trim()) + "</div>";
        var rows = "";
        lines.slice(1).forEach(function (l) {
          var m = l.match(/^\s*([^:：]+)[:：]\s*(.*)$/);
          if (!m) return;
          var k = m[1].trim(), v = m[2].trim();
          if (k === "画像") {
            h += v ? '<img src="' + api.esc(v) + '" alt="">' : '<div class="ib-img">画像</div>';
          } else {
            rows += "<tr><th>" + api.esc(k) + "</th><td>" + api.esc(v) + "</td></tr>";
          }
        });
        if (rows) h += "<table>" + rows + "</table>";
        return "\n\n" + h + "</div>\n\n";
      });
    },
    html: function (el) {
      // 通常の表の見た目(data)は要約欄の中には付けない
      el.querySelectorAll(".infobox table").forEach(function (t) { t.classList.remove("data"); });
    }
  };
});

})();
/* ===== wikilinks ===== */
(function () {
/* wikilinks: [[ページ名]] / [[slug|表示名]] を、そのページへのリンクに変換する */
Wiki.register("wikilinks", function (api) {
  api.loadCss("plugin.css");
  return {
    markdown: function (md) {
      return md.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, function (_, key, label) {
        var p = api.findPage(key);
        var text = (label || (p ? p.title : key)).trim();
        return p
          ? '<a href="' + api.href(p) + '">' + api.esc(text) + "</a>"
          : '<span class="missing" title="未作成のページ">' + api.esc(text) + "</span>";
      });
    }
  };
});

})();
/* ===== spoiler ===== */
(function () {
/* spoiler: ||ネタバレ|| を、クリックで表示される伏せ字にする */
Wiki.register("spoiler", function (api) {
  api.loadCss("plugin.css");
  return {
    markdown: function (md) {
      return md.replace(/\|\|([^|\n]+)\|\|/g, '<span class="spoiler">$1</span>');
    },
    html: function (el) {
      el.querySelectorAll(".spoiler").forEach(function (s) {
        s.addEventListener("click", function () { s.classList.toggle("open"); });
      });
    }
  };
});

})();
/* ===== callout ===== */
(function () {
/*
 * callout: 色付きの囲み(注意書きなど)を書けるようにする
 *
 *   :::warn 見出し(省略可)
 *   中身はふつうのMarkdownで書けます。
 *   :::
 *
 * 種類: note(補足) / info(情報) / tip(ヒント) / warn(注意) / danger(警告)
 * ※ 囲みの中に別の囲みを入れること(入れ子)はできません。
 */
Wiki.register("callout", function (api) {
  api.loadCss("plugin.css");
  var names = { note: "補足", info: "情報", tip: "ヒント", warn: "注意", danger: "警告" };
  return {
    markdown: function (md) {
      return md.replace(/^:::(note|info|tip|warn|danger)[ \t]*([^\n]*)\r?\n([\s\S]*?)\r?\n:::[ \t]*$/gm,
        function (_, type, title, body) {
          var t = title.trim() || names[type];
          return '\n\n<div class="callout callout-' + type + '">\n\n<div class="callout-title">' +
            api.esc(t) + "</div>\n\n" + body + "\n\n</div>\n\n";
        });
    }
  };
});

})();
/* ===== toc ===== */
(function () {
/*
 * toc: 見出し(##, ###)が一定数以上あるページの、最初の見出しの前に目次を入れる
 * 設定(wiki-data.json): { "name": "toc", "options": { "minHeadings": 3 } }
 */
Wiki.register("toc", function (api) {
  api.loadCss("plugin.css");
  var min = Number(api.options.minHeadings) || 3;
  return {
    html: function (el, ctx) {
      if (ctx.where !== "view") return;
      var heads = el.querySelectorAll("h2, h3");
      if (heads.length < min) return;

      var nav = document.createElement("nav");
      nav.className = "toc";
      var title = document.createElement("div");
      title.className = "toc-title";
      title.textContent = "目次";
      nav.appendChild(title);
      var ol = document.createElement("ol");
      nav.appendChild(ol);

      var n2 = 0, n3 = 0;
      heads.forEach(function (h, i) {
        h.id = "sec-" + (i + 1);
        var num;
        if (h.tagName === "H2") { n2++; n3 = 0; num = String(n2); }
        else { n3++; num = (n2 || 1) + "." + n3; }
        var li = document.createElement("li");
        li.className = h.tagName === "H2" ? "l2" : "l3";
        var a = document.createElement("a");
        a.href = "#" + h.id;
        a.textContent = num + " " + h.textContent;
        li.appendChild(a);
        ol.appendChild(li);
      });
      heads[0].parentNode.insertBefore(nav, heads[0]);
    }
  };
});

})();
/* ===== backlinks ===== */
(function () {
/*
 * backlinks: 各ページの末尾に「このページへのリンク元」(このページを [[ ]] で参照しているページ)を出す
 * 全ページの本文を取得して調べます(ページが多いサイトでは読み込みが少し増えます)。
 */
Wiki.register("backlinks", function (api) {
  api.loadCss("plugin.css");

  function rx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  return {
    html: function (el, ctx) {
      if (ctx.where !== "view" || !ctx.page) return;
      var me = ctx.page;
      var re = new RegExp("\\[\\[\\s*(?:" + rx(me.slug) + "|" + rx(me.title) + ")\\s*(?:\\||\\]\\])");
      var others = api.pages().filter(function (p) { return p.slug !== me.slug; });
      Promise.all(others.map(function (p) {
        return api.getText(p.slug).then(function (t) { return re.test(t) ? p : null; });
      })).then(function (found) {
        found = found.filter(Boolean);
        if (!found.length || !el.isConnected) return;
        var box = document.createElement("div");
        box.className = "backlinks";
        var title = document.createElement("div");
        title.className = "backlinks-title";
        title.textContent = "このページへのリンク元";
        var ul = document.createElement("ul");
        found.forEach(function (p) {
          var li = document.createElement("li");
          var a = document.createElement("a");
          a.href = api.href(p);
          a.textContent = p.title;
          li.appendChild(a);
          ul.appendChild(li);
        });
        box.appendChild(title);
        box.appendChild(ul);
        el.appendChild(box);
      });
    }
  };
});

})();
/* ===== table-sort ===== */
(function () {
/* table-sort: 表の見出しをクリックすると、その列で並べ替える(数字は数の大小、文字は五十音順) */
Wiki.register("table-sort", function (api) {
  api.loadCss("plugin.css");

  function cell(row, i) {
    var c = row.cells[i];
    var t = c ? c.textContent.trim() : "";
    var n = parseFloat(t.replace(/[,\s]/g, ""));
    return { t: t, n: n };
  }

  return {
    html: function (el) {
      el.querySelectorAll("table.data").forEach(function (table) {
        if (table.closest(".infobox")) return;
        var rows = Array.prototype.slice.call(table.rows);
        if (rows.length < 3 || !rows[0].querySelector("th")) return;
        var body = rows.slice(1);
        var heads = Array.prototype.slice.call(rows[0].cells);

        heads.forEach(function (th, i) {
          th.classList.add("sortable");
          th.title = "クリックで並べ替え";
          th.addEventListener("click", function () {
            var dir = th.getAttribute("data-sort") === "asc" ? "desc" : "asc";
            heads.forEach(function (h) { h.removeAttribute("data-sort"); });
            th.setAttribute("data-sort", dir);
            var sorted = body.slice().sort(function (a, b) {
              var x = cell(a, i), y = cell(b, i);
              var r = (!isNaN(x.n) && !isNaN(y.n))
                ? x.n - y.n
                : x.t.localeCompare(y.t, "ja", { numeric: true });
              return dir === "asc" ? r : -r;
            });
            sorted.forEach(function (r) { r.parentNode.appendChild(r); });
          });
        });
      });
    }
  };
});

})();
/* ===== image-zoom ===== */
(function () {
/* image-zoom: ページ内の画像をクリックすると大きく表示する(閉じるのは、もう一度クリックか Esc キー) */
Wiki.register("image-zoom", function (api) {
  api.loadCss("plugin.css");
  var overlay = null;

  function close() {
    if (overlay) { overlay.remove(); overlay = null; }
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  return {
    html: function (el) {
      el.querySelectorAll("img").forEach(function (img) {
        if (img.closest("a")) return;
        img.classList.add("zoomable");
        img.addEventListener("click", function () {
          close();
          overlay = document.createElement("div");
          overlay.className = "zoom-overlay";
          var big = document.createElement("img");
          big.src = img.currentSrc || img.src;
          big.alt = img.alt;
          overlay.appendChild(big);
          overlay.addEventListener("click", close);
          document.body.appendChild(overlay);
        });
      });
    }
  };
});

})();
/* ===== external-links ===== */
(function () {
/* external-links: 外部サイトへのリンクを新しいタブで開き、末尾に ↗ を付ける */
Wiki.register("external-links", function (api) {
  api.loadCss("plugin.css");
  return {
    html: function (el) {
      el.querySelectorAll("a[href]").forEach(function (a) {
        var u;
        try { u = new URL(a.getAttribute("href"), location.href); } catch (e) { return; }
        if ((u.protocol === "http:" || u.protocol === "https:") && u.host !== location.host) {
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.classList.add("external");
        }
      });
    }
  };
});

})();
/* ===== fulltext-search ===== */
(function () {
/*
 * fulltext-search: サイドバーの検索で、ページの本文の中も探す(ページ名・説明・キーワードの結果の下に出る)
 * 最初の検索のときに全ページの本文を取得して、そのあとは使い回します。
 * 設定(wiki-data.json): { "name": "fulltext-search", "options": { "limit": 20, "minLength": 2 } }
 */
Wiki.register("fulltext-search", function (api) {
  var limit = Number(api.options.limit) || 20;
  var minLen = Number(api.options.minLength) || 2;
  var docs = null;

  function load() {
    if (!docs) {
      docs = Promise.all(api.pages().map(function (p) {
        return api.getText(p.slug).then(function (t) { return { page: p, text: plain(t) }; });
      }));
    }
    return docs;
  }
  // 記法の記号を取り除いて、検索しやすい文字だけにする
  function plain(md) {
    return md
      .replace(/```[a-z]*\r?\n/g, " ")
      .replace(/```/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
      .replace(/\[\[([^\]]+)\]\]/g, "$1")
      .replace(/\|\|/g, "")
      .replace(/[#*>`|]/g, " ")
      .replace(/\s+/g, " ");
  }

  return {
    search: function (q) {
      if (q.length < minLen) return [];
      var ql = q.toLowerCase();
      return load().then(function (list) {
        var out = [];
        list.forEach(function (d) {
          var i = d.text.toLowerCase().indexOf(ql);
          if (i < 0 || out.length >= limit) return;
          var from = Math.max(0, i - 12);
          var snippet = (from > 0 ? "…" : "") + d.text.slice(from, i + q.length + 28).trim();
          out.push({ title: d.page.title, href: api.href(d.page), note: "本文: " + snippet });
        });
        return out;
      });
    }
  };
});

})();
/* ===== recent-changes ===== */
(function () {
/*
 * recent-changes: 「最近の更新」ページ(page.html?view=recent)を追加し、サイドバーにリンクを出す
 * 並び順は wiki-data.json の各ページの "updated"(サイト上で保存すると自動で入る)で決まります。
 * 設定(wiki-data.json): { "name": "recent-changes", "options": { "limit": 30 } }
 */
Wiki.register("recent-changes", function (api) {
  var limit = Number(api.options.limit) || 30;
  return {
    sidebar: function (el) {
      var a = document.createElement("a");
      a.href = api.viewHref("recent");
      a.textContent = "最近の更新";
      el.appendChild(a);
    },
    views: {
      recent: {
        title: "最近の更新",
        render: function (body) {
          var list = api.pages().slice().sort(function (a, b) {
            return String(b.updated || "").localeCompare(String(a.updated || ""));
          }).slice(0, limit);
          if (!list.length) { body.textContent = "まだページがありません。"; return; }
          var rows = list.map(function (p) {
            return "<tr><td>" + api.esc(p.updated || "—") + '</td><td><a href="' + api.href(p) + '">' + api.esc(p.title) +
              "</a></td><td>" + api.esc(p.category) + "</td><td>" + api.esc(p.summary || "") + "</td></tr>";
          }).join("");
          body.innerHTML = '<table class="data"><tr><th>更新日</th><th>ページ</th><th>カテゴリ</th><th>説明</th></tr>' + rows + "</table>";
        }
      }
    }
  };
});

})();
/* ===== random-page ===== */
(function () {
/* random-page: サイドバーに「おまかせ表示」を出し、押すとランダムなページを開く */
Wiki.register("random-page", function (api) {
  return {
    sidebar: function (el) {
      var a = document.createElement("a");
      a.href = "#";
      a.textContent = "おまかせ表示";
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        var cur = new URLSearchParams(location.search).get("p");
        var list = api.pages().filter(function (p) { return p.slug !== cur; });
        if (!list.length) return;
        location.href = api.href(list[Math.floor(Math.random() * list.length)]);
      });
      el.appendChild(a);
    }
  };
});

})();
/* ===== dark-mode ===== */
(function () {
/* dark-mode: サイドバーのボタンで、テーマを「自動 → ライト → ダーク」と切り替える(選んだ設定はこのブラウザに保存) */
Wiki.register("dark-mode", function (api) {
  api.loadCss("plugin.css");
  var KEY = "wikiTheme";
  var modes = ["auto", "light", "dark"];
  var labels = { auto: "テーマ: 自動", light: "テーマ: ライト", dark: "テーマ: ダーク" };

  function get() {
    try { var v = localStorage.getItem(KEY); return modes.indexOf(v) >= 0 ? v : "auto"; } catch (e) { return "auto"; }
  }
  function set(m) {
    try { if (m === "auto") localStorage.removeItem(KEY); else localStorage.setItem(KEY, m); } catch (e) {}
  }
  function apply(m) {
    if (m === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", m);
  }

  apply(get()); // 画面を描く前に反映する
  return {
    sidebar: function (el) {
      var a = document.createElement("a");
      a.href = "#";
      a.textContent = labels[get()];
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        var next = modes[(modes.indexOf(get()) + 1) % modes.length];
        set(next);
        apply(next);
        a.textContent = labels[next];
      });
      el.appendChild(a);
    }
  };
});

})();
/* ===== editor-toolbar ===== */
(function () {
/* editor-toolbar: 編集画面に、記法を挿入するボタンを並べる */
Wiki.register("editor-toolbar", function (api) {
  return {
    editor: function (ed) {
      ed.addButton("見出し", "見出しを挿入", function () { ed.wrap("\n## ", "\n", "見出し"); });
      ed.addButton("太字", "選択部分を太字に", function () { ed.wrap("**", "**", "太字"); });
      ed.addButton("リンク", "ページへのリンク [[ ]]", function () { ed.wrap("[[", "]]", "ページ名"); });
      ed.addButton("表", "表を挿入", function () {
        ed.insert("\n| 列1 | 列2 |\n|-----|-----|\n| 内容 | 内容 |\n");
      });
      ed.addButton("ネタバレ", "ネタバレの伏せ字 || ||", function () { ed.wrap("||", "||", "ネタバレ"); });
      ed.addButton("要約欄", "インフォボックスを挿入", function () {
        ed.insert("\n```infobox\n名前\n画像:\n項目1: 内容\n項目2: 内容\n```\n");
      });
    }
  };
});

})();
/* ===== image-upload ===== */
(function () {
/*
 * image-upload: 編集画面から画像をGitHubに追加して、本文に挿入する
 *
 * 使い方(編集画面で):
 *   ・ツールバーの「画像を追加」ボタンから、画像ファイルを選ぶ
 *   ・画像をコピーして、本文の欄に貼り付ける(Ctrl+V)
 *   ・画像ファイルを、本文の欄にドラッグ&ドロップする
 * 画像は images/ フォルダにコミットされ、本文に ![名前](images/名前.png) が入ります。
 *
 * 対応形式: PNG / JPEG / GIF / WebP(SVGは、安全のため追加できません)
 * 幅が大きい画像は、自動で縮小してから保存します(GIFは縮小しません)。
 * 保存後、公開サイトに反映されるまでの1〜2分は、このブラウザでは追加した画像をそのまま表示します。
 *
 * 設定(wiki-data.json): { "name": "image-upload", "options": { "dir": "images", "maxMB": 5, "maxWidth": 1600 } }
 */
Wiki.register("image-upload", function (api) {
  var dir = String(api.options.dir || "images").replace(/^\/+|\/+$/g, "");
  if (!/^[a-z0-9][a-z0-9_\/-]*$/.test(dir)) dir = "images";
  var maxBytes = (Number(api.options.maxMB) || 5) * 1024 * 1024;
  var maxWidth = Number(api.options.maxWidth) || 1600;
  var TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };
  var FRESH_MS = 10 * 60 * 1000;
  var CACHE_LIMIT = 2500000; // sessionStorage に残す画像の大きさの上限(文字数)

  /* ---------- 反映前の表示用に、追加した画像をこのブラウザに覚えておく ---------- */
  function cacheSet(path, dataUrl) {
    if (dataUrl.length > CACHE_LIMIT) return;
    try { sessionStorage.setItem("wikiFreshImg:" + path, JSON.stringify({ t: Date.now(), data: dataUrl })); } catch (e) {}
  }
  function cached(path) {
    try {
      var o = JSON.parse(sessionStorage.getItem("wikiFreshImg:" + path) || "null");
      if (o && Date.now() - o.t < FRESH_MS) return o.data;
    } catch (e) {}
    return null;
  }

  /* ---------- 画像の準備 ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function stamp() {
    var d = new Date();
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  }
  function baseName(name) {
    var b = String(name || "").toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    // 日本語などで英数字がほとんど残らない名前は、日時の名前にする(残った文字は後ろに付ける)
    return b.length >= 3 ? b : "image-" + stamp() + (b ? "-" + b : "");
  }
  // サイトのセキュリティ設定(CSP)で blob: の画像は読み込めないので、data: 形式にして読み込む
  function loadImage(file) {
    return toDataUrl(file).then(function (url) {
      return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () { reject(new Error("画像を読み込めませんでした")); };
        img.src = url;
      });
    });
  }
  // 幅が大きすぎる画像は縮小する。縮小で小さくならなければ、元のまま使う
  async function prepare(file) {
    if (file.type === "image/gif") return { blob: file, resized: false };
    var img = await loadImage(file);
    if (img.naturalWidth <= maxWidth) return { blob: file, resized: false };
    var c = document.createElement("canvas");
    c.width = maxWidth;
    c.height = Math.max(1, Math.round(img.naturalHeight * maxWidth / img.naturalWidth));
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    var blob = await new Promise(function (r) { c.toBlob(r, file.type, 0.9); });
    if (blob && blob.size < file.size) return { blob: blob, resized: true };
    return { blob: file, resized: false };
  }
  function toDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error("ファイルを読み込めませんでした")); };
      r.readAsDataURL(blob);
    });
  }
  async function freeName(base, ext) {
    var name = base + "." + ext;
    for (var n = 2; n <= 20; n++) {
      if (!(await api.github.exists(dir + "/" + name))) return name;
      name = base + "-" + n + "." + ext;
    }
    return base + "-" + stamp() + "." + ext;
  }

  /* ---------- 1枚をアップロードして、挿入する本文を返す ---------- */
  async function uploadOne(file) {
    var ext = TYPES[file.type];
    if (!ext) throw new Error("画像(PNG・JPEG・GIF・WebP)だけ追加できます: " + (file.name || "ファイル"));
    var prepared = await prepare(file);
    if (prepared.blob.size > maxBytes) {
      throw new Error("画像が大きすぎます(上限 " + Math.round(maxBytes / 1024 / 1024 * 100) / 100 + "MB): " + (file.name || "画像"));
    }
    var dataUrl = await toDataUrl(prepared.blob);
    var name = await freeName(baseName(file.name), ext);
    var path = dir + "/" + name;
    await api.github.putBase64(path, dataUrl.split(",")[1], "画像を追加: " + name);
    cacheSet(path, dataUrl);
    return { path: path, alt: name.replace(/\.[^.]+$/, ""), resized: prepared.resized };
  }

  return {
    editor: function (ed) {
      var busy = false;

      async function handle(files) {
        if (busy) { ed.status("前の画像を追加しています。少し待ってください", true); return; }
        busy = true;
        var done = 0, resized = 0;
        try {
          for (var i = 0; i < files.length; i++) {
            ed.status("画像を追加中… (" + (i + 1) + "/" + files.length + ") " + (files[i].name || ""), false);
            var r = await uploadOne(files[i]);
            ed.insert("\n![" + r.alt + "](" + r.path + ")\n");
            done++;
            if (r.resized) resized++;
          }
          ed.status("画像を追加しました(" + done + "枚)" + (resized ? "。幅が大きい画像は縮小しました" : "") +
            "。保存すると本文に反映され、公開サイトでは1〜2分後に表示されます。", false);
        } catch (e) {
          ed.status("画像を追加できませんでした: " + (e.status ? api.github.explain(e) : e.message) +
            (done ? "(先に追加した" + done + "枚は挿入済みです)" : ""), true);
        } finally {
          busy = false;
        }
      }

      if (!api.github.ready()) return;

      ed.addButton("画像を追加", "画像を選んでGitHubに追加し、本文に挿入する", function () {
        var input = document.createElement("input");
        input.type = "file";
        input.accept = "image/png,image/jpeg,image/gif,image/webp";
        input.multiple = true;
        input.addEventListener("change", function () {
          if (input.files && input.files.length) handle(Array.prototype.slice.call(input.files));
        });
        input.click();
      });

      var ta = ed.textarea;
      ta.addEventListener("paste", function (ev) {
        var files = Array.prototype.filter.call((ev.clipboardData && ev.clipboardData.files) || [], function (f) {
          return f.type.indexOf("image/") === 0;
        });
        if (!files.length) return; // 文字の貼り付けは、そのまま
        ev.preventDefault();
        handle(files);
      });
      ta.addEventListener("dragover", function (ev) {
        if (ev.dataTransfer && Array.prototype.indexOf.call(ev.dataTransfer.types || [], "Files") >= 0) ev.preventDefault();
      });
      ta.addEventListener("drop", function (ev) {
        var files = ev.dataTransfer && ev.dataTransfer.files;
        if (!files || !files.length) return;
        ev.preventDefault(); // ブラウザがファイルを開いて編集中の内容が消えるのを防ぐ
        handle(Array.prototype.slice.call(files));
      });
    },

    // サイトに反映される前は画像が見つからないので、追加した画像をこのブラウザの記憶から表示する
    html: function (el) {
      el.querySelectorAll("img").forEach(function (img) {
        var src = img.getAttribute("src") || "";
        if (src.indexOf(dir + "/") !== 0) return;
        function fallback() {
          var d = cached(src);
          if (d && img.getAttribute("src") !== d) img.src = d;
        }
        img.addEventListener("error", fallback);
        if (img.complete && img.naturalWidth === 0) fallback();
      });
    }
  };
});

})();
/* ===== draft-autosave ===== */
(function () {
/*
 * draft-autosave: 編集中の内容をこのブラウザに自動で下書き保存する
 * 保存し忘れてタブを閉じたり、競合で保存できなかったりしたときに、編集画面の「下書きを復元」ボタンで戻せます。
 * 保存に成功すると、下書きは自動で消えます。
 */
Wiki.register("draft-autosave", function (api) {
  var PREFIX = "wikiDraft:";

  function read(key) {
    try { return JSON.parse(localStorage.getItem(PREFIX + key) || "null"); } catch (e) { return null; }
  }
  function write(key, v) {
    try {
      if (v) localStorage.setItem(PREFIX + key, JSON.stringify(v));
      else localStorage.removeItem(PREFIX + key);
    } catch (e) {}
  }

  return {
    editor: function (ed, ctx) {
      var key = ctx.page ? ctx.page.slug : "__new__";
      var ta = ed.textarea;
      var initial = ta.value;
      var timer = null;

      var d = read(key);
      if (d && typeof d.text === "string" && d.text !== initial) {
        var when = new Date(d.t).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
        ed.addButton("下書きを復元(" + when + ")", "保存されなかった編集内容に戻す", function () {
          ta.value = d.text;
          ta.dispatchEvent(new Event("input"));
        });
      }

      function flush() {
        clearTimeout(timer);
        write(key, ta.value !== initial ? { t: Date.now(), text: ta.value } : null);
      }
      ta.addEventListener("input", function () {
        clearTimeout(timer);
        timer = setTimeout(flush, 500);
      });
      window.addEventListener("pagehide", flush);
      ed.onSaved(function () {
        window.removeEventListener("pagehide", flush);
        clearTimeout(timer);
        write(key, null);
      });
    }
  };
});

})();
/* ===== hero ===== */
(function () {
/*
 * hero: ページの上に、大きな画像つきのバナー(ヒーロー)を出す
 *
 * 本文に、こう書きます(行はどれも省略できます):
 *
 *   ```hero
 *   画像: images/banner.png
 *   タイトル: LOLBeansへようこそ
 *   説明: みんなで作る非公式Wiki
 *   ボタン: ゲーム概要 | game-overview
 *   高さ: 280
 *   暗さ: 40
 *   ```
 *
 * 画像: images/ の画像か、https:// で始まるURL。無ければ色のグラデーションになります
 * ボタン: 「文字 | 行き先」。行き先はページ名(slug)かタイトル、または https:// のURL。何個でも書けます
 * 高さ: 120〜600(px)  /  暗さ: 0〜80(%)。画像の上に重ねる黒の濃さで、文字を読みやすくします
 * ※ 追加したばかりの画像は、公開サイトに出るまで1〜2分かかります。
 */
Wiki.register("hero", function (api) {
  api.loadCss("plugin.css");

  function safeUrl(v) {
    v = String(v || "").trim();
    if (/^https:\/\/[^\s"'()\\<>]+$/.test(v)) return v;
    if (/^[A-Za-z0-9][A-Za-z0-9._\/-]*$/.test(v) && v.indexOf("..") < 0) return v;
    return "";
  }
  function num(v, min, max, def) {
    var n = parseInt(v, 10);
    return isNaN(n) ? def : Math.max(min, Math.min(max, n));
  }

  return {
    markdown: function (md) {
      return md.replace(/```hero[ \t]*\r?\n([\s\S]*?)```/g, function (_, body) {
        var o = { buttons: [] };
        body.split(/\r?\n/).forEach(function (l) {
          var m = l.match(/^\s*([^:：]+)[:：]\s*(.*)$/);
          if (!m) return;
          var k = m[1].trim(), v = m[2].trim();
          if (k === "ボタン") o.buttons.push(v); else o[k] = v;
        });
        var h = '<div class="hero" data-img="' + api.esc(safeUrl(o["画像"])) + '" data-h="' + num(o["高さ"], 120, 600, 260) +
          '" data-dim="' + num(o["暗さ"], 0, 80, 35) + '"><div class="hero-inner">';
        if (o["タイトル"]) h += '<div class="hero-title">' + api.esc(o["タイトル"]) + "</div>";
        if (o["説明"]) h += '<div class="hero-sub">' + api.esc(o["説明"]) + "</div>";
        if (o.buttons.length) {
          h += '<div class="hero-btns">';
          o.buttons.forEach(function (b) {
            var parts = b.split(/[|｜]/), label = parts[0].trim(), to = (parts[1] || "").trim();
            if (!label) return;
            var p = api.findPage(to), url = p ? api.href(p) : safeUrl(to);
            h += url ? '<a class="hero-btn" href="' + api.esc(url) + '">' + api.esc(label) + "</a>" : "";
          });
          h += "</div>";
        }
        return "\n\n" + h + "</div></div>\n\n";
      });
    },
    html: function (el) {
      el.querySelectorAll(".hero").forEach(function (d) {
        var img = d.getAttribute("data-img"), h = num(d.getAttribute("data-h"), 120, 600, 260), dim = num(d.getAttribute("data-dim"), 0, 80, 35);
        d.style.minHeight = h + "px";
        var shade = "linear-gradient(rgba(0,0,0," + (dim / 100 * 0.6).toFixed(2) + "),rgba(0,0,0," + (dim / 100).toFixed(2) + "))";
        if (safeUrl(img)) d.style.backgroundImage = shade + ', url("' + safeUrl(img) + '")';
        else d.classList.add("hero-plain");
      });
    },
    editor: function (ed) {
      ed.addButton("ヒーロー", "ページの上に画像つきバナーを入れる", function () {
        ed.insert("\n```hero\n画像: images/\nタイトル: タイトル\n説明: 一言の説明\nボタン: 文字 | game-overview\n高さ: 260\n暗さ: 35\n```\n");
      });
    }
  };
});

})();
/* ===== page-background ===== */
(function () {
/*
 * page-background: サイト全体、またはページごとの背景画像
 *
 * ■ サイト全体の背景: assets/wiki-data.json の "plugins" に、設定つきで書く
 *     { "name": "page-background", "options": { "image": "images/bg.png", "opacity": 88 } }
 *   (画像を決めないときは、何も表示しません)
 *
 * ■ ページごとの背景: 本文のどこかに書く(そのページだけ、サイト全体の設定より優先)
 *     ```background
 *     画像: images/stage-bg.png
 *     不透明度: 85
 *     ```
 *   画像: 「なし」と書くと、そのページだけ背景を消します
 *
 * 画像: images/ の画像か、https:// で始まるURL
 * 不透明度: 40〜100(%)。本文の下に敷く板の濃さです。小さいほど背景が透けますが、文字は読みにくくなります
 * ※ 追加したばかりの画像は、公開サイトに出るまで1〜2分かかります。
 */
Wiki.register("page-background", function (api) {
  api.loadCss("plugin.css");

  function safeUrl(v) {
    v = String(v || "").trim();
    if (/^https:\/\/[^\s"'()\\<>]+$/.test(v)) return v;
    if (/^[A-Za-z0-9][A-Za-z0-9._\/-]*$/.test(v) && v.indexOf("..") < 0) return v;
    return "";
  }
  function num(v, min, max, def) {
    var n = parseInt(v, 10);
    return isNaN(n) ? def : Math.max(min, Math.min(max, n));
  }
  var site = { img: safeUrl(api.options.image), opacity: num(api.options.opacity, 40, 100, 88) };

  function apply(img, opacity) {
    var bg = document.getElementById("wiki-bg");
    if (!img) {
      if (bg) bg.remove();
      document.body.classList.remove("has-bg");
      return;
    }
    if (!bg) {
      bg = document.createElement("div");
      bg.id = "wiki-bg";
      document.body.insertBefore(bg, document.body.firstChild);
    }
    bg.style.backgroundImage = 'url("' + img + '")';
    document.body.classList.add("has-bg");
    document.body.style.setProperty("--bg-panel", (opacity / 100).toFixed(2));
  }

  return {
    markdown: function (md) {
      return md.replace(/```background[ \t]*\r?\n([\s\S]*?)```/g, function (_, body) {
        var o = {};
        body.split(/\r?\n/).forEach(function (l) {
          var m = l.match(/^\s*([^:：]+)[:：]\s*(.*)$/);
          if (m) o[m[1].trim()] = m[2].trim();
        });
        var none = /^(なし|none)$/i.test(o["画像"] || "");
        return '\n\n<div class="bg-set" hidden data-none="' + (none ? "1" : "") + '" data-img="' + api.esc(safeUrl(o["画像"])) +
          '" data-op="' + num(o["不透明度"], 40, 100, site.opacity) + '"></div>\n\n';
      });
    },
    html: function (el, ctx) {
      if (ctx && ctx.where === "preview") return; // 編集中のプレビューでは、背景を変えない
      var set = el.querySelector(".bg-set");
      if (set) {
        if (set.getAttribute("data-none")) apply("", 0);
        else apply(safeUrl(set.getAttribute("data-img")) || site.img, num(set.getAttribute("data-op"), 40, 100, site.opacity));
      } else {
        apply(site.img, site.opacity);
      }
    },
    editor: function (ed) {
      ed.addButton("背景", "このページの背景画像を決める", function () {
        ed.insert("\n```background\n画像: images/\n不透明度: 88\n```\n");
      });
    }
  };
});

})();