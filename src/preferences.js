// src/preferences.js
import { emitWithAck } from "./socket.js";

const MAX_KEYWORDS = 10;
const ERROR_LABELS = {
  invalid_mode: "通知の受け方を選んでください。",
  invalid_keywords: "キーワードは1〜30文字で、10個までです。",
  keywords_required: "「キーワードのみ」では、キーワードを1個以上登録してください。",
};

function describePreference({ mode, keywords }) {
  if (mode !== "keywords") return "すべて通知";
  return `キーワードのみ（${keywords.join("、")}）`;
}

// 通知の受け方の設定画面。「現在の設定」には、サーバに保存された内容だけを表示する。
export function startPreferences(socket) {
  const fields = document.querySelector("#preferences-fields");
  const saved = document.querySelector("#preferences-saved");
  const status = document.querySelector("#preferences-status");
  const list = document.querySelector("#keyword-list");
  const form = document.querySelector("#keyword-form");
  const input = document.querySelector("#keyword-input");
  const saveButton = document.querySelector("#preferences-save");
  const modeInputs = [...document.querySelectorAll('input[name="notification-mode"]')];

  let draftKeywords = [];
  let isDirty = false;

  function renderKeywords() {
    list.replaceChildren(
      ...draftKeywords.map((keyword, index) => {
        const item = document.createElement("li");
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = `${keyword} ×`;
        remove.setAttribute("aria-label", `${keyword} を削除`);
        remove.addEventListener("click", () => {
          draftKeywords.splice(index, 1);
          renderKeywords();
          markDirty();
        });
        item.append(remove);
        return item;
      }),
    );
  }

  function markDirty() {
    isDirty = true;
    status.textContent = "変更はまだ保存されていません。";
  }

  function showSaved(preference) {
    saved.textContent = `現在の設定: ${describePreference(preference)}`;
  }

  function loadDraft(preference) {
    modeInputs.forEach((radio) => (radio.checked = radio.value === preference.mode));
    draftKeywords = [...preference.keywords];
    isDirty = false;
    renderKeywords();
  }

  // 入力欄の語を一覧に加える。上限を超える場合は加えず false を返す。
  function addTypedKeyword() {
    const keyword = input.value.trim();
    if (!keyword) return true;
    if (!draftKeywords.includes(keyword)) {
      if (draftKeywords.length >= MAX_KEYWORDS) {
        status.textContent = ERROR_LABELS.invalid_keywords;
        return false;
      }
      draftKeywords.push(keyword);
      renderKeywords();
      markDirty();
    }
    input.value = "";
    return true;
  }

  // 再接続でも届く。編集中の内容は上書きしない。
  socket.on("preferences:current", (preference) => {
    showSaved(preference);
    if (!isDirty) loadDraft(preference);
    fields.disabled = false;
  });

  modeInputs.forEach((radio) => radio.addEventListener("change", markDirty));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    addTypedKeyword();
  });

  saveButton.addEventListener("click", async () => {
    // 「追加」を押し忘れた入力中の語も保存する。
    if (!addTypedKeyword()) return;

    const mode = modeInputs.find((radio) => radio.checked)?.value;
    fields.disabled = true;
    status.textContent = "保存中...";
    try {
      const result = await emitWithAck(socket, "preferences:update", {
        mode,
        keywords: draftKeywords,
      });
      if (result.ok) {
        showSaved(result);
        loadDraft(result);
        status.textContent = "保存しました。";
      } else {
        status.textContent = `保存できませんでした。${ERROR_LABELS[result.error] ?? ""}`;
      }
    } catch {
      status.textContent = "保存できませんでした。接続を確認してください。";
    } finally {
      fields.disabled = false;
    }
  });
}
