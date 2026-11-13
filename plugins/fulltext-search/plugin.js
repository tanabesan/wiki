/*
 * fulltext-search: サイドバーの検索で、ページの本文の中も探す(ページ名・説明・キーワードの結果の下に出る)
 * 最初の検索のときに全ページの本文を取得して、そのあとは使い回します。
 * 設定(wiki-data.json): { "name": "fulltext-search", "options": { "limit": 20, "minLength": 2 } }
 */
Wiki.register("fulltext-search", function (api) {
  var limit = Number(api.options.limit) || 20;
  var minLen = Number(api.options.minLength) || 2;
  var docs = null;

  function load() {
    if (!docs) {
      docs = Promise.all(api.pages().map(function (p) {
        return api.getText(p.slug).then(function (t) { return { page: p, text: plain(t) }; });
      }));
    }
    return docs;
  }
  // 記法の記号を取り除いて、検索しやすい文字だけにする
  function plain(md) {
    return md
      .replace(/```[a-z]*\r?\n/g, " ")
      .replace(/```/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
      .replace(/\[\[([^\]]+)\]\]/g, "$1")
      .replace(/\|\|/g, "")
      .replace(/[#*>`|]/g, " ")
      .replace(/\s+/g, " ");
  }

  return {
    search: function (q) {
      if (q.length < minLen) return [];
      var ql = q.toLowerCase();
      return load().then(function (list) {
        var out = [];
        list.forEach(function (d) {
          var i = d.text.toLowerCase().indexOf(ql);
          if (i < 0 || out.length >= limit) return;
          var from = Math.max(0, i - 12);
          var snippet = (from > 0 ? "…" : "") + d.text.slice(from, i + q.length + 28).trim();
          out.push({ title: d.page.title, href: api.href(d.page), note: "本文: " + snippet });
        });
        return out;
      });
    }
  };
});
