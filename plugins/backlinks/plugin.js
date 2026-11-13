/*
 * backlinks: 各ページの末尾に「このページへのリンク元」(このページを [[ ]] で参照しているページ)を出す
 * 全ページの本文を取得して調べます(ページが多いサイトでは読み込みが少し増えます)。
 */
Wiki.register("backlinks", function (api) {
  api.loadCss("plugin.css");

  function rx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  return {
    html: function (el, ctx) {
      if (ctx.where !== "view" || !ctx.page) return;
      var me = ctx.page;
      var re = new RegExp("\\[\\[\\s*(?:" + rx(me.slug) + "|" + rx(me.title) + ")\\s*(?:\\||\\]\\])");
      var others = api.pages().filter(function (p) { return p.slug !== me.slug; });
      Promise.all(others.map(function (p) {
        return api.getText(p.slug).then(function (t) { return re.test(t) ? p : null; });
      })).then(function (found) {
        found = found.filter(Boolean);
        if (!found.length || !el.isConnected) return;
        var box = document.createElement("div");
        box.className = "backlinks";
        var title = document.createElement("div");
        title.className = "backlinks-title";
        title.textContent = "このページへのリンク元";
        var ul = document.createElement("ul");
        found.forEach(function (p) {
          var li = document.createElement("li");
          var a = document.createElement("a");
          a.href = api.href(p);
          a.textContent = p.title;
          li.appendChild(a);
          ul.appendChild(li);
        });
        box.appendChild(title);
        box.appendChild(ul);
        el.appendChild(box);
      });
    }
  };
});
