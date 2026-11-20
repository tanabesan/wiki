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
    editor: function (ed) {
      ed.addItem("挿入", {
        label: "囲み(補足・注意など)", hint: ":::種類 で囲む", icon: "info",
        fields: [
          { name: "type", label: "種類", type: "select", value: "note", options: [["note", "補足"], ["info", "情報"], ["tip", "ヒント"], ["warn", "注意"], ["danger", "警告"]] },
          { name: "title", label: "タイトル(空なら種類の名前)", type: "text" },
          { name: "body", label: "本文", type: "textarea", required: true }
        ],
        run: function (v) { ed.insert("\n:::" + v.type + (v.title ? " " + v.title : "") + "\n" + v.body + "\n:::\n"); }
      });
    },
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
 * toc: 見出し(##, ###, ####)から目次を作る
 *
 *   ・見出しが一定数以上あるページでは、最初の見出しの前に、自動で目次が入ります
 *   ・好きな場所に入れたいときは、本文に {{目次}} と1行で書きます(見出しが少なくても出ます。編集画面の「目次」ボタンでも入ります)
 *   ・このページには目次を出したくないときは、本文に {{目次なし}} と1行で書きます
 *
 * 設定(wiki-data.json): { "name": "toc", "options": { "minHeadings": 3 } }
 */
Wiki.register("toc", function (api) {
  api.loadCss("plugin.css");
  var min = Number(api.options.minHeadings) || 3;

  function build(heads) {
    var nav = document.createElement("nav");
    nav.className = "toc";
    var title = document.createElement("div");
    title.className = "toc-title";
    title.textContent = "目次";
    nav.appendChild(title);
    var ol = document.createElement("ol");
    nav.appendChild(ol);

    var n2 = 0, n3 = 0, n4 = 0;
    heads.forEach(function (h, i) {
      h.id = "sec-" + (i + 1);
      var num, cls;
      if (h.tagName === "H2") { n2++; n3 = 0; n4 = 0; num = String(n2); cls = "l2"; }
      else if (h.tagName === "H3") { n3++; n4 = 0; num = (n2 || 1) + "." + n3; cls = "l3"; }
      else { n4++; num = (n2 || 1) + "." + (n3 || 1) + "." + n4; cls = "l4"; }
      var li = document.createElement("li");
      li.className = cls;
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = num + " " + h.textContent;
      li.appendChild(a);
      ol.appendChild(li);
    });
    return nav;
  }

  return {
    markdown: function (md) {
      return md
        .replace(/^[ \t]*\{\{(?:目次|toc)\}\}[ \t]*$/gm, '\n\n<div class="toc-here"></div>\n\n')
        .replace(/^[ \t]*\{\{(?:目次なし|notoc)\}\}[ \t]*$/gm, '\n\n<div class="toc-none"></div>\n\n');
    },
    html: function (el, ctx) {
      var here = el.querySelector(".toc-here"), none = el.querySelector(".toc-none");
      if (none) none.remove();
      if (ctx.where !== "view") { // 編集中のプレビューでは、目次の場所だけ示す
        if (here) { here.className = "toc-hint"; here.textContent = "ここに目次が入ります"; }
        return;
      }
      var heads = el.querySelectorAll("h2, h3, h4");
      if (none) { if (here) here.remove(); return; }
      if (here) {
        if (heads.length) here.parentNode.replaceChild(build(heads), here); else here.remove();
        return;
      }
      if (heads.length < min) return;
      heads[0].parentNode.insertBefore(build(heads), heads[0]);
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
/* ===== embed ===== */
(function () {
/*
 * embed: URLだけの行を、動画やリンクカードにする
 *   YouTube(youtube.com / youtu.be)→ 動画プレーヤー
 *   ニコニコ動画(nicovideo.jp / nico.ms)→ 動画プレーヤー
 *   X(x.com / twitter.com)のポスト → リンクカード(ポストの埋め込みは外部スクリプトが必要なので、カードにしています)
 *   {{カード: URL | タイトル}} → どのサイトでも使えるリンクカード(タイトルは省略可)
 * 編集画面の「リンク」カテゴリから入れられます
 */
Wiki.register("embed", function (api) {
  // スタイルはこのファイルの中に持つ(plugin.css は不要)
  if (!document.getElementById("embed-style")) {
    var st = document.createElement("style");
    st.id = "embed-style";
    st.textContent = ".embed { display: block; margin: 16px 0; }\n.embed-video { position: relative; aspect-ratio: 16 / 9; max-width: 640px; border-radius: var(--radius, 16px); overflow: hidden; background: #000; }\n.embed-video iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }\n.embed-card { display: flex; align-items: center; gap: 12px; max-width: 560px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface-2, var(--panel)); color: var(--text); text-decoration: none; }\n.embed-card:hover { border-color: var(--accent); }\n.embed-card::after { content: none !important; }\n.embed-ico { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 10px; background: var(--accent-soft, rgba(109,94,252,.14)); color: var(--accent); font-weight: 700; }\n.embed-x .embed-ico { background: #000; color: #fff; }\n.embed-tx { display: grid; gap: 2px; min-width: 0; }\n.embed-tx b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.embed-tx span { color: var(--muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }";
    document.head.appendChild(st);
  }

  function parse(raw) {
    var u;
    try { u = new URL(raw); } catch (e) { return null; }
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    var h = u.hostname.replace(/^www\.|^m\./, ""), m;
    if (h === "youtu.be") m = u.pathname.slice(1);
    else if (h === "youtube.com") m = u.searchParams.get("v") || (u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/) || [])[1];
    if ((h === "youtu.be" || h === "youtube.com") && m && /^[\w-]{6,20}$/.test(m)) {
      var t = parseInt(u.searchParams.get("t") || u.searchParams.get("start") || "0", 10) || 0;
      return { kind: "youtube", id: m, start: t };
    }
    if (h === "nicovideo.jp" || h === "nico.ms") {
      m = u.pathname.match(/\/((?:sm|nm|so)\d+)/) || (h === "nico.ms" && u.pathname.match(/\/((?:sm|nm|so)\d+)/));
      if (m) return { kind: "nico", id: m[1] };
    }
    if (h === "x.com" || h === "twitter.com") {
      m = u.pathname.match(/^\/([\w]{1,15})\/status\/(\d+)/);
      if (m) return { kind: "x", user: m[1], id: m[2], url: "https://x.com/" + m[1] + "/status/" + m[2] };
    }
    return null;
  }

  function ph(attrs) {
    return '\n\n<div class="embed-ph"' + Object.keys(attrs).map(function (k) {
      return " data-" + k + '="' + api.esc(String(attrs[k])) + '"';
    }).join("") + "></div>\n\n";
  }

  return {
    markdown: function (md) {
      // コードブロックの中は触らない
      var parts = md.split(/(```[\s\S]*?```)/);
      return parts.map(function (part, i) {
        if (i % 2) return part;
        part = part.replace(/^\{\{カード[:：][ \t]*(https?:\/\/[^\s|｜}]+)[ \t]*(?:[|｜][ \t]*([^}\n]*?))?[ \t]*\}\}[ \t]*$/gm, function (_, url, title) {
          return ph({ kind: "card", url: url, title: title || "" });
        });
        return part.replace(/^[ \t]*<?(https?:\/\/[^\s<>]+)>?[ \t]*$/gm, function (all, url) {
          var p = parse(url);
          if (!p) return all;
          p.url = p.url || url;
          return ph(p);
        });
      }).join("");
    },
    html: function (el) {
      el.querySelectorAll(".embed-ph").forEach(function (n) {
        var d = n.dataset, box = document.createElement("div");
        if (d.kind === "youtube" || d.kind === "nico") {
          box.className = "embed embed-video";
          var f = document.createElement("iframe");
          f.src = d.kind === "youtube"
            ? "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(d.id) + (Number(d.start) ? "?start=" + Number(d.start) : "")
            : "https://embed.nicovideo.jp/watch/" + encodeURIComponent(d.id);
          f.title = d.kind === "youtube" ? "YouTube の動画" : "ニコニコ動画";
          f.loading = "lazy";
          f.allowFullscreen = true;
          f.setAttribute("allow", "fullscreen; picture-in-picture");
          f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
          box.appendChild(f);
        } else {
          var url = d.url || "";
          var host;
          try { host = new URL(url).hostname.replace(/^www\./, ""); } catch (e) { n.remove(); return; }
          var a = document.createElement("a");
          a.className = "embed embed-card" + (d.kind === "x" ? " embed-x" : "");
          a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
          var t1 = d.kind === "x" ? "@" + d.user + " のポスト" : (d.title || host);
          var t2 = d.kind === "x" ? "X で見る  ·  " + host : url;
          var b = document.createElement("b"); b.textContent = t1;
          var s = document.createElement("span"); s.textContent = t2;
          var ico = document.createElement("span");
          ico.className = "embed-ico"; ico.textContent = d.kind === "x" ? "𝕏" : "↗";
          a.appendChild(ico);
          var tx = document.createElement("span"); tx.className = "embed-tx";
          tx.appendChild(b); tx.appendChild(s); a.appendChild(tx);
          box = a;
        }
        n.replaceWith(box);
      });
    },
    editor: function (ed) {
      ed.addItem("リンク", {
        label: "動画・ポスト", hint: "YouTube / ニコニコ動画 / X のURLを貼る", icon: "smart_display",
        fields: [{ name: "url", label: "URL", type: "text", required: true, placeholder: "https://www.youtube.com/watch?v=…" }],
        run: function (v) {
          if (!parse(v.url)) { ed.status("対応していないURLです(YouTube・ニコニコ動画・Xのポスト)。リンクカードを使ってください", true); return; }
          ed.insert("\n\n" + v.url + "\n\n");
        }
      });
      ed.addItem("リンク", {
        label: "リンクカード", hint: "どのサイトでも、カード状のリンクにする", icon: "link",
        fields: [
          { name: "url", label: "URL", type: "text", required: true, placeholder: "https://" },
          { name: "title", label: "タイトル(空ならサイト名)", type: "text" }
        ],
        run: function (v) {
          if (!/^https?:\/\/\S+$/.test(v.url)) { ed.status("URLは http:// か https:// で始めてください", true); return; }
          ed.insert("\n\n{{カード: " + v.url + (v.title ? " | " + v.title : "") + "}}\n\n");
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
/*
 * editor-toolbar: 編集画面に、記法を挿入するボタンを並べる
 * カテゴリ(見出し/文字/挿入)のボタンを押すと、モーダルで機能を選べる。入力が要る機能(リンク・表・要約欄)はモーダルで入力する
 *   大見出し / 中見出し / 小見出し: カーソルのある行(選んだ行すべて)を見出しにする。同じボタンをもう一度押すと、ふつうの文に戻る
 *   目次: カーソルの位置に {{目次}} を入れる(その場所に目次が出る。toc プラグインが有効なとき)
 */
Wiki.register("editor-toolbar", function (api) {
  return {
    editor: function (ed) {
      // 選んだ行(未選択ならカーソルの行)の見出しの段階を、level に変える。同じ段階なら、見出しをやめる
      function heading(level) {
        var ta = ed.textarea, v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
        var ls = v.lastIndexOf("\n", s - 1) + 1;
        var le = v.indexOf("\n", e > s ? e - 1 : e);
        if (le < 0) le = v.length;
        var lines = v.slice(ls, le).split("\n");
        var mark = new Array(level + 1).join("#");
        var out = lines.map(function (line) {
          var m = line.match(/^(#{1,6})[ \t]+(.*)$/);
          var cur = m ? m[1].length : 0, text = m ? m[2] : line.trim();
          if (!text && !m) return mark + " 見出し";
          if (cur === level) return text;
          return mark + " " + text;
        }).join("\n");
        ta.setRangeText(out, ls, le, "end");
        ta.dispatchEvent(new Event("input"));
      }

      ed.addItem("見出し", { label: "大見出し", hint: "## もう一度選ぶと元に戻る", icon: "title", run: function () { heading(2); } });
      ed.addItem("見出し", { label: "中見出し", hint: "### もう一度選ぶと元に戻る", icon: "format_h3", run: function () { heading(3); } });
      ed.addItem("見出し", { label: "小見出し", hint: "#### もう一度選ぶと元に戻る", icon: "format_h4", run: function () { heading(4); } });
      ed.addItem("見出し", { label: "目次", hint: "この位置に {{目次}} を入れる", icon: "toc", run: function () { ed.insert("\n{{目次}}\n"); } });

      ed.addItem("文字", { label: "太字", hint: "選択部分を **太字** に", icon: "format_bold", run: function () { ed.wrap("**", "**", "太字"); } });
      ed.addItem("文字", { label: "ネタバレ", hint: "選択部分を伏せ字に ||  ||", icon: "visibility_off", run: function () { ed.wrap("||", "||", "ネタバレ"); } });
      ed.addItem("文字", {
        label: "ページへのリンク", hint: "[[ページ名]] を入れる", icon: "link", submitLabel: "挿入する",
        fields: [
          { name: "page", label: "リンク先のページ(slug か名前)", type: "page", required: true },
          { name: "text", label: "表示する文字(空なら、そのまま)", type: "text" }
        ],
        run: function (v) { ed.insert("[[" + v.page + (v.text ? "|" + v.text : "") + "]]"); }
      });

      ed.addItem("挿入", {
        label: "表", hint: "列と行の数を決めて表を入れる", icon: "table_chart",
        fields: [
          { name: "cols", label: "列の数", type: "number", value: 2, min: 1, max: 12, required: true },
          { name: "rows", label: "行の数(見出し行を除く)", type: "number", value: 2, min: 1, max: 50, required: true }
        ],
        run: function (v) {
          var c = Math.max(1, Math.min(12, Math.round(v.cols))), r = Math.max(1, Math.min(50, Math.round(v.rows)));
          var row = function (t) { var a = []; for (var i = 1; i <= c; i++) a.push(t === "h" ? "列" + i : t === "s" ? "-----" : "内容"); return "| " + a.join(" | ") + " |"; };
          var lines = [row("h"), row("s")];
          for (var k = 0; k < r; k++) lines.push(row("c"));
          ed.insert("\n" + lines.join("\n") + "\n");
        }
      });
      ed.addItem("挿入", {
        label: "要約欄(インフォボックス)", hint: "名前・画像・項目を入れる", icon: "article",
        fields: [
          { name: "name", label: "名前", type: "text", required: true },
          { name: "image", label: "画像(任意)", type: "image" },
          { name: "items", label: "項目(1行に1つ「項目名: 内容」)", type: "textarea", value: "項目1: 内容\n項目2: 内容" }
        ],
        run: function (v) {
          var lines = ["```infobox", v.name];
          if (v.image) lines.push("画像: " + v.image);
          String(v.items).split("\n").forEach(function (l) { if (l.trim()) lines.push(l.trim()); });
          lines.push("```");
          ed.insert("\n" + lines.join("\n") + "\n");
        }
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

      // 他のプラグイン(「概要」タブの入力欄など)から、画像を1枚選んで追加してもらうための入口。追加できたら cb(画像のパス) を呼ぶ
      ed.pickImage = function (cb) {
        var input = document.createElement("input");
        input.type = "file";
        input.accept = "image/png,image/jpeg,image/gif,image/webp";
        input.addEventListener("change", async function () {
          var f = input.files && input.files[0];
          if (!f) return;
          if (busy) { ed.status("前の画像を追加しています。少し待ってください", true); return; }
          busy = true;
          try {
            ed.status("画像を追加中… " + (f.name || ""), false);
            var r = await uploadOne(f);
            ed.status("画像を追加しました: " + r.path + "。保存すると反映され、公開サイトでは1〜2分後に表示されます。", false);
            cb(r.path);
          } catch (e) {
            ed.status("画像を追加できませんでした: " + (e.status ? api.github.explain(e) : e.message), true);
          } finally {
            busy = false;
          }
        });
        input.click();
      };

      ed.addItem("画像", { label: "画像を追加", hint: "画像を選んでGitHubに追加し、本文に挿入する", icon: "add_photo_alternate", run: function () {
        var input = document.createElement("input");
        input.type = "file";
        input.accept = "image/png,image/jpeg,image/gif,image/webp";
        input.multiple = true;
        input.addEventListener("change", function () {
          if (input.files && input.files.length) handle(Array.prototype.slice.call(input.files));
        });
        input.click();
      } });

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
 * 左メニューのページ名は、そのページのヒーローの画像が背景になります(ヒーローの無いページは、ふつうの表示のまま)
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

  // 左メニューのページ名の背景に、そのページのヒーロー画像を敷く
  function decorateMenu() {
    var links = document.querySelectorAll(".nav a[href]");
    Array.prototype.forEach.call(links, function (a) {
      var m = (a.getAttribute("href") || "").match(/[?&]p=([^&#]+)/);
      if (!m || !/^[A-Za-z0-9._-]+$/.test(decodeURIComponent(m[1]))) return;
      fetch("content/" + decodeURIComponent(m[1]) + ".md")
        .then(function (r) { return r.ok ? r.text() : ""; })
        .then(function (md) {
          var b = md.match(/```hero[ \t]*\r?\n([\s\S]*?)```/);
          var im = b && b[1].match(/^\s*画像[:：]\s*(.*)$/m);
          var url = im ? safeUrl(im[1]) : "";
          if (!url) return;
          a.style.setProperty("--thumb", "url(\"" + url.replace(/"/g, "") + "\")");
          a.classList.add("has-thumb");
        })
        .catch(function () {});
    });
  }

  return {
    sidebar: function () { decorateMenu(); },
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
      var RE = /```hero[ \t]*\r?\n[\s\S]*?```[ \t]*(\r?\n)?/;
      function line(v) { return String(v || "").replace(/[\r\n]+/g, " ").trim(); }

      function read() {
        var m = ed.getText().match(RE), o = { on: !!m, img: "", title: "", sub: "", btns: [], h: 260, dim: 35 };
        if (!m) return o;
        m[0].split(/\r?\n/).forEach(function (l) {
          var k = l.match(/^\s*([^:：]+)[:：]\s*(.*)$/);
          if (!k) return;
          var key = k[1].trim(), v = k[2].trim();
          if (key === "画像") o.img = v; else if (key === "タイトル") o.title = v; else if (key === "説明") o.sub = v;
          else if (key === "ボタン") { var p = v.split(/[|｜]/); o.btns.push([(p[0] || "").trim(), (p[1] || "").trim()]); }
          else if (key === "高さ") o.h = num(v, 120, 600, 260); else if (key === "暗さ") o.dim = num(v, 0, 80, 35);
        });
        return o;
      }
      function write(o) {
        var t = ed.getText();
        if (!o.on) { ed.setText(t.replace(RE, "")); return; }
        var b = "```hero\n";
        if (o.img) b += "画像: " + o.img + "\n";
        if (o.title) b += "タイトル: " + o.title + "\n";
        if (o.sub) b += "説明: " + o.sub + "\n";
        o.btns.forEach(function (x) { if (x[0]) b += "ボタン: " + x[0] + (x[1] ? " | " + x[1] : "") + "\n"; });
        b += "高さ: " + o.h + "\n暗さ: " + o.dim + "\n```\n";
        ed.setText(RE.test(t) ? t.replace(RE, function () { return b; }) : b + "\n" + t);
      }

      function field(label, input) {
        var l = document.createElement("label");
        l.appendChild(document.createTextNode(label));
        l.appendChild(input);
        return l;
      }
      function text(ph) { var i = document.createElement("input"); i.type = "text"; if (ph) i.placeholder = ph; return i; }
      function range(min, max, step) {
        var r = document.createElement("input"); r.type = "range"; r.min = min; r.max = max; r.step = step;
        return r;
      }

      var sec = ed.addSection("ヒーロー(ページ上部のバナー)", function (body) {
        var on = document.createElement("input"); on.type = "checkbox";
        var onLabel = document.createElement("label"); onLabel.className = "ed-check";
        onLabel.appendChild(on); onLabel.appendChild(document.createTextNode("このページの上にヒーローを表示する"));
        var box = document.createElement("div");
        var img = text("images/banner.png"), pick = document.createElement("button");
        pick.type = "button"; pick.className = "btn ghost ed-small"; pick.textContent = "画像を選ぶ";
        var pr = document.createElement("div"); pr.className = "ed-pick"; pr.appendChild(img); pr.appendChild(pick);
        var title = text("ページのタイトルなど"), sub = text("一言の説明");
        var datalist = document.createElement("datalist"); datalist.id = "hero-pages";
        api.pages().forEach(function (pg) { var op = document.createElement("option"); op.value = pg.slug; op.label = pg.title; datalist.appendChild(op); });
        var btnRows = [0, 1, 2].map(function () { return [text("ボタンの文字"), text("行き先(ページ名や https://…)")]; });
        btnRows.forEach(function (r) { r[1].setAttribute("list", "hero-pages"); });
        var h = range(120, 600, 10), hOut = document.createElement("output");
        var d = range(0, 80, 5), dOut = document.createElement("output");

        var row1 = document.createElement("div"); row1.className = "ed-row one"; row1.appendChild(field("背景の画像", pr));
        var row2 = document.createElement("div"); row2.className = "ed-row"; row2.appendChild(field("タイトル", title)); row2.appendChild(field("説明", sub));
        box.appendChild(row1); box.appendChild(row2); box.appendChild(datalist);
        btnRows.forEach(function (r, i) {
          var row = document.createElement("div"); row.className = "ed-row";
          row.appendChild(field("ボタン " + (i + 1), r[0])); row.appendChild(field("行き先", r[1])); box.appendChild(row);
        });
        function rg(label, input, out, unit) {
          var w = document.createElement("label"); w.className = "ed-range";
          w.appendChild(document.createTextNode(label)); w.appendChild(input); w.appendChild(out); return w;
        }
        var row3 = document.createElement("div"); row3.className = "ed-row";
        row3.appendChild(rg("高さ", h, hOut)); row3.appendChild(rg("暗さ", d, dOut));
        box.appendChild(row3);
        var note = document.createElement("p"); note.className = "ed-note";
        note.textContent = "画像を決めないときは、色のグラデーションになります。暗さは、画像の上に重ねる黒の濃さです。";
        box.appendChild(note);
        body.appendChild(onLabel); body.appendChild(box);

        var busy = false;
        function show(o) {
          if (busy) return;
          on.checked = o.on; box.hidden = !o.on;
          img.value = o.img; title.value = o.title; sub.value = o.sub;
          btnRows.forEach(function (r, i) { r[0].value = (o.btns[i] || ["", ""])[0]; r[1].value = (o.btns[i] || ["", ""])[1]; });
          h.value = o.h; d.value = o.dim; hOut.textContent = o.h + "px"; dOut.textContent = o.dim + "%";
        }
        function collect() {
          hOut.textContent = h.value + "px"; dOut.textContent = d.value + "%";
          box.hidden = !on.checked;
          return { on: on.checked, img: line(img.value), title: line(title.value), sub: line(sub.value),
            btns: btnRows.map(function (r) { return [line(r[0].value), line(r[1].value)]; }), h: num(h.value, 120, 600, 260), dim: num(d.value, 0, 80, 35) };
        }
        body.addEventListener("input", function () { write(collect()); });
        body.addEventListener("change", function () { write(collect()); });
        pick.addEventListener("click", function () {
          if (!ed.pickImage) { ed.status("画像を選ぶには、image-upload プラグインが有効で、編集のトークンが設定されている必要があります", true); return; }
          ed.pickImage(function (path) { img.value = path; write(collect()); });
        });
        ed.onOverview(function () { show(read()); });
        show(read());
      });

      ed.addItem("ページ", { label: "ヒーロー", hint: "「概要」タブで、ページ上部のバナーを設定する", icon: "panorama", run: function () {
        ed.openOverview();
        sec.scrollIntoView({ block: "start" });
      } });
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
      var RE = /```background[ \t]*\r?\n[\s\S]*?```[ \t]*(\r?\n)?/;
      function line(v) { return String(v || "").replace(/[\r\n]+/g, " ").trim(); }
      // mode: "site"(サイト全体の設定を使う) / "custom"(このページだけ画像を指定) / "none"(このページは背景なし)
      function read() {
        var m = ed.getText().match(RE), o = { mode: "site", img: "", op: site.opacity };
        if (!m) return o;
        o.mode = "custom";
        m[0].split(/\r?\n/).forEach(function (l) {
          var k = l.match(/^\s*([^:：]+)[:：]\s*(.*)$/);
          if (!k) return;
          var key = k[1].trim(), v = k[2].trim();
          if (key === "画像") { if (/^(なし|none)$/i.test(v)) o.mode = "none"; else o.img = v; }
          else if (key === "不透明度") o.op = num(v, 40, 100, site.opacity);
        });
        return o;
      }
      function write(o) {
        var t = ed.getText();
        if (o.mode === "site") { ed.setText(t.replace(RE, "")); return; }
        var b = "```background\n" + (o.mode === "none" ? "画像: なし\n" : (o.img ? "画像: " + o.img + "\n" : "") + "不透明度: " + o.op + "\n") + "```\n";
        ed.setText(RE.test(t) ? t.replace(RE, function () { return b; }) : b + "\n" + t);
      }

      var sec = ed.addSection("背景画像", function (body) {
        var sel = document.createElement("select");
        [["site", site.img ? "サイト全体の背景を使う" : "背景なし(サイト全体の設定)"], ["custom", "このページだけ、画像を指定する"], ["none", "このページは、背景を消す"]].forEach(function (x) {
          var op = document.createElement("option"); op.value = x[0]; op.textContent = x[1]; sel.appendChild(op);
        });
        sel.className = "ed-select";
        var selLabel = document.createElement("label"); selLabel.appendChild(document.createTextNode("背景")); selLabel.appendChild(sel);
        var box = document.createElement("div");
        var img = document.createElement("input"); img.type = "text"; img.placeholder = "images/bg.png";
        var pick = document.createElement("button"); pick.type = "button"; pick.className = "btn ghost ed-small"; pick.textContent = "画像を選ぶ";
        var pr = document.createElement("div"); pr.className = "ed-pick"; pr.appendChild(img); pr.appendChild(pick);
        var imgLabel = document.createElement("label"); imgLabel.appendChild(document.createTextNode("背景の画像")); imgLabel.appendChild(pr);
        var op = document.createElement("input"); op.type = "range"; op.min = 40; op.max = 100; op.step = 1;
        var out = document.createElement("output");
        var opLabel = document.createElement("label"); opLabel.className = "ed-range";
        opLabel.appendChild(document.createTextNode("本文の板の濃さ")); opLabel.appendChild(op); opLabel.appendChild(out);
        var note = document.createElement("p"); note.className = "ed-note";
        note.textContent = "小さくするほど背景が透けますが、文字は読みにくくなります。";
        var r1 = document.createElement("div"); r1.className = "ed-row one"; r1.appendChild(imgLabel);
        var r2 = document.createElement("div"); r2.className = "ed-row one"; r2.appendChild(opLabel);
        box.appendChild(r1); box.appendChild(r2); box.appendChild(note);
        var r0 = document.createElement("div"); r0.className = "ed-row one"; r0.appendChild(selLabel);
        body.appendChild(r0); body.appendChild(box);

        function show(o) {
          sel.value = o.mode; box.hidden = o.mode !== "custom";
          img.value = o.img; op.value = o.op; out.textContent = o.op + "%";
        }
        function collect() {
          out.textContent = op.value + "%"; box.hidden = sel.value !== "custom";
          return { mode: sel.value, img: line(img.value), op: num(op.value, 40, 100, site.opacity) };
        }
        body.addEventListener("input", function () { write(collect()); });
        body.addEventListener("change", function () { write(collect()); });
        pick.addEventListener("click", function () {
          if (!ed.pickImage) { ed.status("画像を選ぶには、image-upload プラグインが有効で、編集のトークンが設定されている必要があります", true); return; }
          ed.pickImage(function (path) { img.value = path; sel.value = "custom"; box.hidden = false; write(collect()); });
        });
        ed.onOverview(function () { show(read()); });
        show(read());
      });

      ed.addItem("ページ", { label: "背景", hint: "「概要」タブで、このページの背景を設定する", icon: "wallpaper", run: function () {
        ed.openOverview();
        sec.scrollIntoView({ block: "start" });
      } });
    }
  };
});

})();
/* ===== スタイル ===== */
(function () {
  var s = document.createElement("style");
  s.id = "wiki-bundle-style";
  s.textContent = "/* ===== infobox ===== */\n.infobox {\n  float: right; width: 280px; margin: 0 0 16px 24px;\n  background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow);\n  overflow: hidden; font-size: 0.9rem;\n}\n.infobox .ib-title { background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #fff; padding: 8px 12px; font-weight: 700; text-align: center; }\n.infobox .ib-img { background: var(--accent-soft); color: var(--muted); text-align: center; padding: 40px 0; font-size: 0.8rem; }\n.infobox img { display: block; width: 100%; }\n.infobox table { width: 100%; border-collapse: collapse; }\n.infobox th, .infobox td { padding: 6px 10px; border-top: 1px solid var(--line); text-align: left; vertical-align: top; }\n.infobox th { width: 38%; color: var(--muted); font-weight: 500; }\n@media (max-width: 800px) {\n  .infobox { float: none; width: 100%; margin: 0 0 20px; }\n}\n\n/* ===== wikilinks ===== */\n.missing { color: var(--muted); border-bottom: 1px dotted var(--muted); cursor: help; }\n\n/* ===== spoiler ===== */\n.spoiler { background: var(--text); color: var(--text); border-radius: 6px; padding: 1px 8px; cursor: pointer; }\n.spoiler.open { background: transparent; }\n\n/* ===== callout ===== */\n.callout {\n  --c: #3b82f6; position: relative; overflow: hidden; margin: 1.2em 0; padding: 6px 18px 8px 22px;\n  background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);\n}\n.callout::before { content: \"\"; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--c); }\n.callout-title { font-weight: 700; margin-top: 6px; color: var(--c); }\n.callout > p:last-child { margin-bottom: 6px; }\n.callout-note   { --c: #6b7280; }\n.callout-info   { --c: #3b82f6; }\n.callout-tip    { --c: #12a594; }\n.callout-warn   { --c: #e5930a; }\n.callout-danger { --c: #d6455d; }\n\n/* ===== toc ===== */\n.toc {\n  display: inline-block; min-width: 240px; max-width: 100%;\n  margin: 1em 0; padding: 14px 20px 16px;\n  background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);\n  font-size: 0.9rem;\n}\n.toc-title { font-size: 0.75rem; letter-spacing: 0.1em; color: var(--muted); font-weight: 700; margin-bottom: 4px; }\n.toc ol { list-style: none; margin: 0; padding: 0; line-height: 1.9; }\n.toc .l3 { padding-left: 1.4em; font-size: 0.95em; }\n.toc a { color: var(--accent); }\n.toc .l4 { padding-left: 2.8em; font-size: 0.92em; }\n.toc-hint { margin: 1em 0; padding: 10px 16px; border: 1px dashed var(--line); border-radius: var(--radius); color: var(--muted); font-size: 0.85rem; }\n\n/* ===== backlinks ===== */\n.backlinks {\n  clear: both; margin-top: 3em; padding: 10px 18px 12px;\n  background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); font-size: 0.9rem;\n}\n.backlinks-title { font-weight: 700; margin-bottom: 4px; }\n.backlinks ul { margin: 0; padding-left: 1.2em; }\n\n/* ===== table-sort ===== */\nth.sortable { cursor: pointer; user-select: none; white-space: nowrap; }\nth.sortable::after { content: \" ↕\"; color: var(--muted); font-size: 0.8em; }\nth.sortable[data-sort=\"asc\"]::after { content: \" ▲\"; color: var(--accent); }\nth.sortable[data-sort=\"desc\"]::after { content: \" ▼\"; color: var(--accent); }\n\n/* ===== image-zoom ===== */\nimg.zoomable { cursor: zoom-in; }\n.zoom-overlay {\n  position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center;\n  background: rgba(0, 0, 0, 0.82); cursor: zoom-out;\n}\n.zoom-overlay img { max-width: 94vw; max-height: 94vh; object-fit: contain; }\n\n/* ===== external-links ===== */\na.external::after { content: \"↗\"; font-size: 0.75em; margin-left: 2px; }\n\n/* ===== dark-mode ===== */\n:root[data-theme=\"light\"] {\n  color-scheme: light;\n  --bg: #f7f7fb;\n  --panel: #ffffff;\n  --surface-2: #f1f1f8;\n  --text: #14131c;\n  --muted: #6b6b80;\n  --line: rgba(20, 19, 28, 0.1);\n  --accent: #6d5efc;\n  --accent-soft: rgba(109, 94, 252, 0.1);\n  --danger: #d6455d;\n  --shadow: 0 1px 2px rgba(20, 19, 28, 0.05), 0 8px 24px -12px rgba(20, 19, 28, 0.12);\n}\n:root[data-theme=\"dark\"] {\n  color-scheme: dark;\n  --bg: #0d0c14;\n  --panel: #16151f;\n  --surface-2: #1e1d2a;\n  --text: #f1f0f8;\n  --muted: #9c9ab0;\n  --line: rgba(255, 255, 255, 0.09);\n  --accent: #8b7dff;\n  --accent-soft: rgba(139, 125, 255, 0.15);\n  --danger: #ff7d92;\n  --shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 12px 32px -16px rgba(0, 0, 0, 0.6);\n}\n\n/* ===== hero ===== */\n.hero {\n  position: relative; display: flex; align-items: flex-end; margin: 0 0 28px;\n  border-radius: 12px; overflow: hidden; color: #fff;\n  background-size: cover; background-position: center; background-color: var(--accent);\n}\n.hero.hero-plain { background-image: linear-gradient(135deg, var(--accent), #2b2b2b); }\n.hero-inner { padding: 28px 32px; max-width: 100%; }\n.hero-title { font-size: 2rem; font-weight: 800; line-height: 1.3; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.45); }\n.hero-sub { margin-top: 6px; font-size: 1.05rem; text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5); }\n.hero-btns { margin-top: 16px; display: flex; flex-wrap: wrap; gap: 10px; }\n.hero-btn {\n  display: inline-block; padding: 8px 18px; border-radius: 999px; font-weight: 600;\n  background: #fff; color: #222; text-decoration: none;\n}\n.hero-btn:hover { background: var(--accent-soft); color: var(--accent); text-decoration: none; }\n@media (max-width: 800px) {\n  .hero-inner { padding: 20px 18px; }\n  .hero-title { font-size: 1.5rem; }\n}\n\n/* 左メニューのページ名: ヒーロー画像を背景に */\n.nav a.has-thumb { position: relative; min-height: 46px; display: flex; align-items: center; color: #fff; font-weight: 700; text-shadow: 0 1px 4px rgba(0,0,0,.7); background: linear-gradient(90deg, rgba(0,0,0,.65), rgba(0,0,0,.2)), var(--thumb) center / cover no-repeat; margin: 3px 0; }\n.nav a.has-thumb:hover { background: linear-gradient(90deg, rgba(0,0,0,.5), rgba(0,0,0,.1)), var(--thumb) center / cover no-repeat; filter: brightness(1.1); }\n.nav a.has-thumb.current { color: #fff; outline: 2px solid var(--accent); outline-offset: -2px; }\n\n/* ===== page-background ===== */\n#wiki-bg {\n  position: fixed; inset: 0; z-index: -1; pointer-events: none;\n  background-size: cover; background-position: center; background-repeat: no-repeat;\n}\nbody.has-bg { background: transparent; }\nbody.has-bg main {\n  background: color-mix(in srgb, var(--bg) calc(var(--bg-panel, 0.88) * 100%), transparent);\n  border-radius: 0;\n}\n.bg-set { display: none; }\n";
  document.head.appendChild(s);
})();