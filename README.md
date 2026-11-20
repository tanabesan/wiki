# LOLBeans Wiki(非公式)

GitHub Pages で公開する、仲間と編集できる静的Wikiです。サーバーは不要で、**サイト上の「編集」ボタンから書き換えて保存するとGitHubに反映**されます。機能は**プラグイン**で足し引きできます。

## 仕組み

- 本文は `content/*.md`(Markdown)、ページ一覧と設定は `assets/wiki-data.json` に入っています。
- 「編集 → 保存」すると、ブラウザからGitHubのAPIを通して、これらのファイルを直接コミットします。
- ページの履歴はGitHubのコミット履歴です(各ページの「履歴」タブから開けます)。
- 編集できるのは、リポジトリの共同編集者だけです。閲覧は誰でもできます(公開リポジトリの場合)。
- 本体(コア)は「ページの表示・検索・編集・保存」だけを担当し、記法や便利機能は `plugins/` のプラグインが担当します。

```
wiki/
├── index.html            トップページ
├── page.html             各ページの表示・編集画面
├── .nojekyll             GitHub PagesでJekyllを無効にする空ファイル
├── assets/
│   ├── wiki-data.json    サイト名・リポジトリ・有効なプラグイン・ページ一覧
│   ├── wiki.js           コア(表示・検索・編集・プラグイン読み込み)
│   └── style.css         デザイン
├── content/
│   ├── *.md              各ページの本文
│   └── _template.md      新規ページのひな形
└── plugins/
    ├── infobox/ wikilinks/ spoiler/ callout/             書き方を増やすもの
    ├── toc/ backlinks/ table-sort/ image-zoom/ external-links/   ページの見た目・動き
    ├── fulltext-search/ recent-changes/ random-page/     探す・見つける
    ├── dark-mode/                                        テーマ切り替え
    ├── editor-toolbar/ image-upload/ draft-autosave/     編集を助けるもの
    ├── hero/ page-background/                            バナーと背景画像
    ├── bundle.js / bundle.css   全プラグインをまとめたもの(自動生成)
    └── _template/        自作プラグインのひな形
```

## セットアップ(最初の1回)

1. GitHubで新しいリポジトリを作る(例: `lolbeans-wiki`)
2. この `wiki/` フォルダの **中身** をリポジトリのルートに置いてプッシュする(`index.html` と `.nojekyll` が直下に来るように)
3. Settings → Pages で、Source を「Deploy from a branch」、Branch を `main` / `/ (root)` にして Save
4. `assets/wiki-data.json` の `"repo"` を `"ユーザー名/リポジトリ名"` に書き換えてコミットする(これで編集機能が有効になります)
5. 数分後に `https://ユーザー名.github.io/リポジトリ名/` で公開される

## プラグインの使い方

### まとめ版(bundle.js)— 基本はこれだけ

同梱のプラグインは `plugins/bundle.js`(と `plugins/bundle.css`)の2ファイルに全部まとめてあります。**この2ファイルを置き換えるだけで、プラグインの追加・更新ができます。** `wiki-data.json` に名前を書かなくても、まとめ版に入っているプラグインは自動で有効になります。

- 止めたいもの: `wiki-data.json` に `"disabled": ["toc", "backlinks"]` のように書く
- 設定(options)を付けたいもの: `"plugins"` に `{ "name": "image-upload", "options": { ... } }` と書く(書いたものは、書いた順で先に読み込まれます)
- 全部止める: `"plugins": []`
- 自作プラグインを `plugins/名前/` に置いたときだけ、`python tools/build-bundle.py` を実行すると、まとめ版に取り込まれます(実行しない場合は、従来どおり `"plugins"` に名前を書けば、フォルダから読み込まれます)
- `plugins/bundle.js` が無いときは、従来どおり `"plugins"` に書いた名前だけをフォルダから読み込みます

### 有効・無効にする(フォルダ方式)

`assets/wiki-data.json` の `"plugins"` に、使うプラグインの名前を並べます。消せば無効になります。

```json
"plugins": [
  "infobox",
  "wikilinks",
  "spoiler",
  "callout",
  { "name": "toc", "options": { "minHeadings": 3 } },
  "backlinks",
  "table-sort",
  "image-zoom",
  "external-links",
  { "name": "fulltext-search", "options": { "limit": 20, "minLength": 2 } },
  { "name": "recent-changes", "options": { "limit": 30 } },
  "random-page",
  "dark-mode",
  "editor-toolbar",
  { "name": "image-upload", "options": { "dir": "images", "maxMB": 5, "maxWidth": 1600 } },
  "draft-autosave"
]
```

- 並び順どおりに適用されます(Markdownの変換は上から順に行われます)。
- 設定が必要なものは `{ "name": "...", "options": { ... } }` の形で書きます。
- `"plugins"` の項目自体が無い場合は、`infobox`・`wikilinks`・`spoiler` の3つだけが有効になります。

### 同梱のプラグイン

| 名前 | 内容 | 設定 |
|------|------|------|
| `infobox` | ` ```infobox ` ブロックを右側の要約欄にする | なし |
| `wikilinks` | `[[ページ名]]` / `[[slug\|表示名]]` をリンクにする(無いページは点線表示) | なし |
| `spoiler` | `\|\|ネタバレ\|\|` をクリックで表示される伏せ字にする | なし |
| `callout` | `:::warn 見出し` 〜 `:::` で、色付きの囲み(注意書きなど)を書ける。種類は note / info / tip / warn / danger(入れ子は不可) | なし |
| `toc` | 見出し(`##`・`###`・`####`)から目次を作る。見出しが一定数以上なら自動で入る。好きな位置には `{{目次}}`、出したくないページには `{{目次なし}}` と1行で書く | `minHeadings`(既定 3) |
| `backlinks` | ページの末尾に「このページへのリンク元」を出す | なし |
| `table-sort` | 表の見出しをクリックして、その列で並べ替える(数字は大小、文字は五十音順) | なし |
| `image-zoom` | 画像をクリックして拡大表示する(閉じるのは、クリックか Esc) | なし |
| `external-links` | 外部サイトへのリンクを新しいタブで開き、`↗` を付ける | なし |
| `fulltext-search` | サイドバーの検索で、ページの本文の中も探す | `limit`(既定 20)、`minLength`(既定 2) |
| `recent-changes` | 「最近の更新」ページを追加し、サイドバーにリンクを出す(更新日順) | `limit`(既定 30) |
| `random-page` | サイドバーに「おまかせ表示」を出し、ランダムなページを開く | なし |
| `dark-mode` | サイドバーのボタンで、テーマを「自動 → ライト → ダーク」と切り替える(ブラウザに保存) | なし |
| `editor-toolbar` | 編集画面に「見出し」「文字」「挿入」のカテゴリボタンを出す。押すとモーダルが開き、大/中/小見出し・目次・太字・ネタバレ・リンク・表・要約欄を選べる(リンク・表・要約欄はモーダルで入力) | なし |
| `image-upload` | 編集画面から画像をGitHubに追加して、本文に挿入する(ボタン・貼り付け・ドラッグ&ドロップ)。幅が大きい画像は自動で縮小する | `dir`(保存先。既定 `images`)、`maxMB`(1枚の上限。既定 5)、`maxWidth`(縮小する幅。既定 1600) |
| `draft-autosave` | 編集中の内容をブラウザに自動で下書き保存し、「下書きを復元」で戻せる(保存に成功すると消える) | なし |
| `hero` | ページの上に、画像・タイトル・ボタンつきの大きなバナーを出す。編集画面の「概要」タブで設定する | なし |
| `page-background` | サイト全体、またはページごとの背景画像。編集画面の「概要」タブで設定する | `image`(全体の背景画像), `opacity`(本文の板の濃さ 40〜100) |

### 追加する(他の人が作ったものや自作)

1. `plugins/名前/` フォルダを置く(中に `plugin.js` が必要。見た目用の `plugin.css` は任意)
2. `assets/wiki-data.json` の `"plugins"` にその名前を足す

プラグイン名は半角の小文字英数字とハイフンだけです。GitHub Pagesは静的ホスティングなので、フォルダを置くだけでは自動で読み込まれず、**手順2の登録が必要**です。

### 自分で作る

`plugins/_template/` をコピーして、フォルダ名と `Wiki.register("名前", ...)` の名前を同じにします(ひな形のコメントに手順があります)。最小の例:

```js
// plugins/hello/plugin.js
Wiki.register("hello", function (api) {
  return {
    markdown: function (md, ctx) {
      return md.replace(/\{\{today\}\}/g, new Date().toLocaleDateString("ja-JP"));
    }
  };
});
```

使えるフック(必要なものだけ書けばOK):

| フック | 呼ばれるとき・できること |
|--------|--------------------------|
| `markdown(md, ctx)` | Markdownを変換する前に呼ばれる。変換後の文字列を返す |
| `html(el, ctx)` | 描画後のHTMLを加工する(目次の挿入、クリック動作の付与など) |
| `sidebar(el)` | サイドバーの `el` にリンクなどを足す |
| `search(q)` | 検索結果を足す。`[{ title, href, note }]` を返す(Promiseも可)。ページ名などの結果の下に出る |
| `editor(ed, ctx)` | 編集画面のツールバーに機能を足す。`ed.addItem(カテゴリ名, {label, hint, icon, fields, run})` でカテゴリのモーダルに項目を足せる(`fields` があると入力フォームが出て、`run(入力値)` が呼ばれる。type は text/textarea/number/select/checkbox/page/image)。ボタンを直接出したいときは `ed.addButton`。他に `ed.insert`・`ed.wrap`。`ed.onSaved(fn)` で保存後の処理を、`ed.status(メッセージ, 赤字か)` で編集画面の下にメッセージを出せる |
| `views` | `page.html?view=名前` という特別ページを追加する(`{ 名前: { title, render(body) } }`)。この中にも `html` フックが適用される |

`ctx` は `{ page, where }` です。`where` は `"view"`(閲覧)か `"preview"`(編集中のプレビュー)で、`page` は新規作成中なら `null` です。

`api` で使えるもの: `api.options`(wiki-data.json で渡した設定)、`api.pages()`、`api.findPage(名前)`、`api.getText(slug)`(ページ本文のMarkdownを取得。Promise。同じページは使い回し、取れなければ空文字)、`api.github`(`ready()`・`exists(path)`・`putBase64(path, base64, message)`・`explain(err)`。編集者のトークンでGitHubに書き込む。画像の追加などに使う)、`api.href(page)`、`api.viewHref(名前)`、`api.esc(文字列)`(HTMLエスケープ)、`api.loadCss("plugin.css")`。

**安全のために**
- プラグインはサイトの中で自由にJavaScriptを実行でき、編集者がブラウザに保存したトークンにも触れます。**中身を確認したものだけを入れてください。** リポジトリに書き込める人は誰でもプラグインを足せる点も覚えておいてください。
- 外から来る文字(ページ名や本文など)をHTMLに入れるときは、`api.esc()` を通してください。
- 1つのプラグインが壊れていても、そのプラグインの分だけ働かなくなるだけで、サイトは動きます。ブラウザの開発者ツールのコンソールに `[wiki]` で始まる警告が出ます。

## 仲間を招待する

1. リポジトリの Settings → Collaborators → Add people で、友達のGitHubアカウントを招待する
2. 友達が招待を承認する(メールかGitHubの通知から)
3. 友達はサイトで任意のページの「編集」を押す → 画面の案内に従って、自分のアクセストークンを1回だけ設定する

## アクセストークンの作り方(編集する人が各自で)

1. [トークン作成ページ](https://github.com/settings/personal-access-tokens/new)を開く(Fine-grained token)
2. Expiration(有効期限)を決める
3. Repository access で「Only select repositories」→ このwikiのリポジトリだけを選ぶ
4. Permissions → Repository permissions → **Contents** を「Read and write」にする
5. 発行された `github_pat_...` をサイトの入力欄に貼る

注意:
- トークンはそのブラウザの中にだけ保存され、GitHub以外には送られません。共用のパソコンでは使わず、使った後はサイドバーの「編集トークンを削除」を押してください。
- **トークンは人に渡さず、1人1つずつ作ってください。** 各自のトークンで保存すると、履歴に本人の名前で残ります。
- 有効期限が切れたら、同じ手順で作り直せば編集できます。

## 使い方

- **編集**: ページ上部の「編集」タブ → 本文を書き換え(右にプレビュー)→「保存する」
- **新規ページ**: サイドバーの「＋ 新しいページを作る」→ ファイル名(半角小文字英数字とハイフン)・ページ名・カテゴリを入れて保存
- **画像の追加**: 編集画面で、ツールバーの「画像を追加」を押して選ぶか、画像を本文の欄に貼り付け(Ctrl+V)・ドラッグ&ドロップします(`image-upload` が有効なとき)。PNG・JPEG・GIF・WebPに対応し、`images/` フォルダに保存されて、本文に `![名前](images/名前.png)` が入ります。ファイル名は半角英数字に整えられ(日本語の名前は日時の名前になります)、同じ名前があれば `-2` などが付きます。SVGは安全のため追加できません。保存後、公開サイトに表示されるまでは1〜2分かかります(その間も、追加した本人のブラウザでは表示されます)
- **履歴**: 各ページの「履歴」タブ(GitHubのコミット履歴が開きます)。戻したいときはGitHub上で以前の版に戻せます
- **ページの削除・名前変更**: GitHub上で `content/xxx.md` を削除し、`assets/wiki-data.json` から該当の項目を消してください

保存してから公開サイトに反映されるまで1〜2分かかります。保存した本人の画面には、すぐに新しい内容が表示されます。

## 書き方

通常のMarkdown(見出し `##`、表、箇条書き、画像 `![説明](assets/xxx.png)` など)が使えます。次の記法は対応するプラグインが有効なときに使えます。

| 書き方 | 結果 | プラグイン |
|--------|------|------------|
| `[[ページ名]]` / `[[slug]]` | そのページへのリンク | `wikilinks` |
| `[[slug\|表示名]]` | 表示名を変えたリンク | `wikilinks` |
| `\|\|ネタバレ\|\|` | クリックで表示される伏せ字 | `spoiler` |
| ` ```infobox ` ブロック | 右側の要約欄(書式は `_template.md` 参照) | `infobox` |
| `:::warn 見出し` 〜 `:::` | 色付きの囲み(note / info / tip / warn / danger) | `callout` |

## 以前のバージョンから更新する場合

すでにGitHubに置いて運用している場合は、`content/` と `assets/wiki-data.json` **以外**を新しいファイルで置き換えてください。この2つはサイト上の編集で書き換わっているため、上書きすると編集内容が消えます。`plugins/bundle.js` と `plugins/bundle.css` も置けば、`wiki-data.json` を触らなくても、まとめ版のプラグインが自動で有効になります(止めたいものだけ `"disabled"` に書く)。まとめ版が無い場合に `"plugins"` の項目自体が無いときは、`infobox`・`wikilinks`・`spoiler` の3つだけが動きます。

## 注意点

- 2人が同時に同じページを編集した場合、後から保存した人には「ほかの人が先に更新した」と表示されます(上書きはされません)。編集内容は画面に残るので、コピーしてからページを開き直し、最新の内容に合わせてやり直してください。
- `main` ブランチに保護ルール(直接プッシュ禁止など)を付けると、サイトからの保存ができなくなります。
- 閲覧時はMarkdownの変換ライブラリ(marked、DOMPurify)をインターネット経由で読み込みます。
- 本文中のHTMLは安全のためサニタイズされ、スクリプトなどは動きません(プラグインのJavaScriptはサニタイズの対象外です)。

## ローカルで確認する

ブラウザの制限で、`index.html` を直接開く(`file://`)と動きません。次のどちらかで確認してください。

- ターミナルで `python3 -m http.server` を実行して `http://localhost:8000/` を開く
- VS Code の拡張機能「Live Server」を使う

## バナー(ヒーロー)と背景画像

先に「画像を追加」で画像を入れておき、本文にこう書きます(どの行も省略できます)。

````
```hero
画像: images/banner.png
タイトル: LOLBeansへようこそ
説明: みんなで作る非公式Wiki
ボタン: ゲーム概要 | game-overview
高さ: 280
暗さ: 40
```
````

````
```background
画像: images/stage-bg.png
不透明度: 85
```
````

- `ボタン` の行き先は、ページ名(slug かタイトル)か `https://` のURLです。何個でも書けます。
- 背景をサイト全体に付けるときは、`wiki-data.json` の `"plugins"` に `{ "name": "page-background", "options": { "image": "images/bg.png", "opacity": 88 } }` と書きます。ページごとの `background` が優先され、`画像: なし` でそのページだけ消せます。
- 追加したばかりの画像は、公開サイトに出るまで1〜2分かかります。

## 見た目(デザイン)とアイコン

- 色や形は `assets/style.css` の先頭にある変数(`--accent` など)で変えられます。暗い配色は、ブラウザの設定に合わせて自動で切り替わります。
- アイコンは、Google の [Material Symbols](https://fonts.google.com/icons) を使っています。インターネットに繋がっていないと、アイコンは出ません(メニューのボタンだけは「☰」で代わりに出ます)。
- トップページのカードのアイコンは、`wiki-data.json` の各ページに `"icon": "flag"` のように、Material Symbols の名前を書くと変えられます(省略すると `article`)。
- Google Fonts を読み込むため、`index.html` と `page.html` のセキュリティ設定(CSP)に `fonts.googleapis.com` と `fonts.gstatic.com` を許可してあります。

## 編集画面のタブ

編集画面には、次の3つのタブがあります。

- **本文**: Markdownを書く画面です。広い画面では、右にプレビューが並びます。
- **プレビュー**: 狭い画面(スマホなど)だけに出ます。本文とプレビューを、この3つのタブで切り替えます。タブは画面の下に固定されます。
- **概要**: ページ名・カテゴリ・一言説明のほか、プラグインが追加した設定(**ヒーロー**・**背景画像**)を入力欄で決められます。入力すると、本文の先頭の ```` ```hero ```` / ```` ```background ```` が自動で書き換わります。画像は「画像を選ぶ」で追加できます(image-upload プラグインが有効で、トークンが設定されているとき)。

## プラグインから「概要」タブに入力欄を足す(editor フック)

| 関数 | 内容 |
|---|---|
| `ed.addSection(見出し, build)` | 「概要」タブに、見出し付きのまとまりを足す。`build(body)` の `body` に入力欄を作って入れる |
| `ed.onOverview(fn)` | 「概要」タブを開いたときに呼ぶ関数を登録する(本文を読み直して、入力欄に反映する) |
| `ed.getText()` / `ed.setText(文字列)` | 本文を取得する / 丸ごと置き換える(プレビューも更新される) |
| `ed.openOverview()` | 「概要」タブを開く |
| `ed.pickImage(cb)` | 画像を1枚選んで追加し、`cb(画像のパス)` を呼ぶ(image-upload が有効なときだけ使える) |

実例は `plugins/hero/plugin.js` と `plugins/page-background/plugin.js` を見てください。