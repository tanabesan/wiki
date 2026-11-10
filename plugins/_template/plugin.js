/*
 * プラグインのひな形(この名前のままでは読み込まれません)
 *
 * 作り方:
 *   1. このフォルダを plugins/好きな名前/ にコピーする
 *      (名前は半角の小文字英数字とハイフンだけ。例: my-plugin)
 *   2. 下の Wiki.register の最初の引数を、フォルダ名と同じにする
 *   3. assets/wiki-data.json の "plugins" に "好きな名前" を足す
 *   4. 使わなくなったら、"plugins" から名前を消すだけでOK(フォルダは残しても害はありません)
 *
 * このひな形がやること: 本文中の {{today}} を、見ている日の日付に置き換える
 *
 * 使えるフック(必要なものだけ書けばOK):
 *   markdown(md, ctx)   Markdown本文を受け取り、変換した文字列を返す
 *   html(el, ctx)       描画後のHTML(DOM)を加工する
 *   sidebar(el)         サイドバーの el にリンクなどを足す
 *   editor(ed, ctx)     編集画面のツールバーにボタンを足す(ed.addButton / ed.insert / ed.wrap)
 *   views               特別ページ page.html?view=名前 を追加する
 *
 * api の中身:
 *   api.options          wiki-data.json で渡した設定  例: { "name": "my-plugin", "options": { "x": 1 } }
 *   api.pages()          ページ一覧(wiki-data.json の pages)
 *   api.findPage(名前)   slug かページ名でページを探す
 *   api.href(page)       ページのURL
 *   api.viewHref(名前)   特別ページのURL
 *   api.esc(文字列)      HTML用のエスケープ(外から来た文字をHTMLに入れるときは必ず通す)
 *   api.loadCss(ファイル名)  plugins/<名前>/ にあるCSSを読み込む
 *
 * 注意: プラグインはサイトの中で自由にJavaScriptを実行できます。
 *       自分で中身を確認したものだけをリポジトリに入れてください。
 */
Wiki.register("my-plugin", function (api) {
  return {
    markdown: function (md, ctx) {
      var d = new Date();
      var s = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
      return md.replace(/\{\{today\}\}/g, s);
    }
  };
});
