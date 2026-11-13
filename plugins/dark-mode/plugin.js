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
