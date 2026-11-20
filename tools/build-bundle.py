#!/usr/bin/env python3
"""plugins/*/plugin.js と plugin.css を、plugins/bundle.js の1ファイルにまとめる(CSSは中に入れる)。
自作プラグインを足したときだけ実行してください:  python tools/build-bundle.py
(_ で始まるフォルダは対象外。並び順は ORDER の順、それ以外は名前順で後ろ)"""
import os, re, sys
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "plugins")
ORDER = ["infobox","wikilinks","spoiler","callout","toc","backlinks","table-sort","image-zoom",
         "external-links","embed","fulltext-search","recent-changes","random-page","dark-mode",
         "editor-toolbar","image-upload","draft-autosave","hero","page-background"]
names = [d for d in sorted(os.listdir(root))
         if not d.startswith("_") and re.match(r"^[a-z0-9][a-z0-9-]*$", d)
         and os.path.isfile(os.path.join(root, d, "plugin.js"))]
names = [n for n in ORDER if n in names] + [n for n in names if n not in ORDER]
js = ["/* 自動生成: tools/build-bundle.py で作られたファイルです。直接は編集しないでください */"]
css = []
for n in names:
    js.append("/* ===== %s ===== */\n(function () {\n%s\n})();" % (n, open(os.path.join(root, n, "plugin.js"), encoding="utf-8").read()))
    cp = os.path.join(root, n, "plugin.css")
    if os.path.isfile(cp):
        css.append("/* ===== %s ===== */\n%s" % (n, open(cp, encoding="utf-8").read()))
import json
if css:  # CSS も bundle.js の中に入れる(bundle.css は作らない)
    js.append("/* ===== スタイル ===== */\n(function () {\n  var s = document.createElement(\"style\");\n  s.id = \"wiki-bundle-style\";\n  s.textContent = %s;\n  document.head.appendChild(s);\n})();" % json.dumps("\n".join(css), ensure_ascii=False))
open(os.path.join(root, "bundle.js"), "w", encoding="utf-8", newline="\n").write("\n".join(js) + "\n")
print("まとめました:", ", ".join(names))