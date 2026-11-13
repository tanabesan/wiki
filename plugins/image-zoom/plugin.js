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
