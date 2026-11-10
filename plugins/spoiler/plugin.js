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
