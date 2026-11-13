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
