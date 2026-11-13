/*
 * draft-autosave: 編集中の内容をこのブラウザに自動で下書き保存する
 * 保存し忘れてタブを閉じたり、競合で保存できなかったりしたときに、編集画面の「下書きを復元」ボタンで戻せます。
 * 保存に成功すると、下書きは自動で消えます。
 */
Wiki.register("draft-autosave", function (api) {
  var PREFIX = "wikiDraft:";

  function read(key) {
    try { return JSON.parse(localStorage.getItem(PREFIX + key) || "null"); } catch (e) { return null; }
  }
  function write(key, v) {
    try {
      if (v) localStorage.setItem(PREFIX + key, JSON.stringify(v));
      else localStorage.removeItem(PREFIX + key);
    } catch (e) {}
  }

  return {
    editor: function (ed, ctx) {
      var key = ctx.page ? ctx.page.slug : "__new__";
      var ta = ed.textarea;
      var initial = ta.value;
      var timer = null;

      var d = read(key);
      if (d && typeof d.text === "string" && d.text !== initial) {
        var when = new Date(d.t).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
        ed.addButton("下書きを復元(" + when + ")", "保存されなかった編集内容に戻す", function () {
          ta.value = d.text;
          ta.dispatchEvent(new Event("input"));
        });
      }

      function flush() {
        clearTimeout(timer);
        write(key, ta.value !== initial ? { t: Date.now(), text: ta.value } : null);
      }
      ta.addEventListener("input", function () {
        clearTimeout(timer);
        timer = setTimeout(flush, 500);
      });
      window.addEventListener("pagehide", flush);
      ed.onSaved(function () {
        window.removeEventListener("pagehide", flush);
        clearTimeout(timer);
        write(key, null);
      });
    }
  };
});
