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
