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
