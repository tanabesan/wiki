/* editor-toolbar: 編集画面に、記法を挿入するボタンを並べる */
Wiki.register("editor-toolbar", function (api) {
  return {
    editor: function (ed) {
      ed.addButton("見出し", "見出しを挿入", function () { ed.wrap("\n## ", "\n", "見出し"); });
      ed.addButton("太字", "選択部分を太字に", function () { ed.wrap("**", "**", "太字"); });
      ed.addButton("リンク", "ページへのリンク [[ ]]", function () { ed.wrap("[[", "]]", "ページ名"); });
      ed.addButton("表", "表を挿入", function () {
        ed.insert("\n| 列1 | 列2 |\n|-----|-----|\n| 内容 | 内容 |\n");
      });
      ed.addButton("ネタバレ", "ネタバレの伏せ字 || ||", function () { ed.wrap("||", "||", "ネタバレ"); });
      ed.addButton("要約欄", "インフォボックスを挿入", function () {
        ed.insert("\n```infobox\n名前\n画像:\n項目1: 内容\n項目2: 内容\n```\n");
      });
    }
  };
});
