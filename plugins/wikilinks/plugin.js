/* wikilinks: [[ページ名]] / [[slug|表示名]] を、そのページへのリンクに変換する */
Wiki.register("wikilinks", function (api) {
  api.loadCss("plugin.css");
  return {
    markdown: function (md) {
      return md.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, function (_, key, label) {
        var p = api.findPage(key);
        var text = (label || (p ? p.title : key)).trim();
        return p
          ? '<a href="' + api.href(p) + '">' + api.esc(text) + "</a>"
          : '<span class="missing" title="未作成のページ">' + api.esc(text) + "</span>";
      });
    }
  };
});
