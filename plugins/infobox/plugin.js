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
