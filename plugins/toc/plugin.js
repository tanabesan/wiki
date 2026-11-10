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
