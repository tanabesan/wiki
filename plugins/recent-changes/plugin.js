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
