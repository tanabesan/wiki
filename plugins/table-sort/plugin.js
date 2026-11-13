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
