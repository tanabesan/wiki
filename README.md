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
    ├── infobox/          ```infobox で右側の要約欄
    ├── wikilinks/        [[ページ名]] でリンク
    ├── spoiler/          ||ネタバレ|| の伏せ字
    ├── toc/              目次を自動で入れる
    ├── recent-changes/   「最近の更新」ページ
    ├── editor-toolbar/   編集画面のボタン(見出し・太字・表など)
    └── _template/        自作プラグインのひな形
```

## セットアップ(最初の1回)

1. GitHubで新しいリポジトリを作る(例: `lolbeans-wiki`)
2. この `wiki/` フォルダの **中身** をリポジトリのルートに置いてプッシュする(`index.html` と `.nojekyll` が直下に来るように)
3. Settings → Pages で、Source を「Deploy from a branch」、Branch を `main` / `/ (root)` にして Save
4. `assets/wiki-data.json` の `"repo"` を `"ユーザー名/リポジトリ名"` に書き換えてコミットする(これで編集機能が有効になります)
5. 数分後に `https://ユーザー名.github.io/リポジトリ名/` で公開される

## プラグインの使い方

### 有効・無効にする

`assets/wiki-data.json` の `"plugins"` に、使うプラグインの名前を並べます。消せば無効になります。

```json
"plugins": [
  "infobox",
  "wikilinks",
  "spoiler",
  { "name": "toc", "options": { "minHeadings": 3 } },
  { "name": "recent-changes", "options": { "limit": 30 } },
  "editor-toolbar"
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
| `toc` | 見出し(`##`・`###`)が一定数以上のページに目次を入れる | `minHeadings`(既定 3) |
| `recent-changes` | 「最近の更新」ページを追加し、サイドバーにリンクを出す(更新日順) | `limit`(既定 30) |
| `editor-toolbar` | 編集画面に、見出し・太字・リンク・表・ネタバレ・要約欄のボタンを出す | なし |

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
| `editor(ed, ctx)` | 編集画面のツールバーにボタンを足す(`ed.addButton`・`ed.insert`・`ed.wrap`) |
| `views` | `page.html?view=名前` という特別ページを追加する(`{ 名前: { title, render(body) } }`) |

`ctx` は `{ page, where }` です。`where` は `"view"`(閲覧)か `"preview"`(編集中のプレビュー)で、`page` は新規作成中なら `null` です。

`api` で使えるもの: `api.options`(wiki-data.json で渡した設定)、`api.pages()`、`api.findPage(名前)`、`api.href(page)`、`api.viewHref(名前)`、`api.esc(文字列)`(HTMLエスケープ)、`api.loadCss("plugin.css")`。

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

## 以前のバージョンから更新する場合

すでにGitHubに置いて運用している場合は、`content/` と `assets/wiki-data.json` **以外**を新しいファイルで置き換えてください。この2つはサイト上の編集で書き換わっているため、上書きすると編集内容が消えます。そのうえで、`assets/wiki-data.json` に `"plugins"` を手で追加してください(上の例のとおり。追加しなくても、`infobox`・`wikilinks`・`spoiler` の3つは動きます)。

## 注意点

- 2人が同時に同じページを編集した場合、後から保存した人には「ほかの人が先に更新した」と表示されます(上書きはされません)。編集内容は画面に残るので、コピーしてからページを開き直し、最新の内容に合わせてやり直してください。
- `main` ブランチに保護ルール(直接プッシュ禁止など)を付けると、サイトからの保存ができなくなります。
- 閲覧時はMarkdownの変換ライブラリ(marked、DOMPurify)をインターネット経由で読み込みます。
- 本文中のHTMLは安全のためサニタイズされ、スクリプトなどは動きません(プラグインのJavaScriptはサニタイズの対象外です)。

## ローカルで確認する

ブラウザの制限で、`index.html` を直接開く(`file://`)と動きません。次のどちらかで確認してください。

- ターミナルで `python3 -m http.server` を実行して `http://localhost:8000/` を開く
- VS Code の拡張機能「Live Server」を使う
