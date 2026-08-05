import { KureTideProvider } from "./providers/kure-provider.js";
import { createTideSnapshot } from "./tide/domain.js";
import { renderTideError, renderTidePanel } from "./tide/view.js";
import { renderCatchDetail } from "./catch-detail.js";
import { createUuid, ensureLogIds } from "./log-model.js";
import { resizePhoto } from "./image-processor.js";
import { deletePhoto, getPhoto, savePhoto } from "./photo-store.js";
import { SNS_CARD_DEFAULTS, redrawSnsCardPhoto, renderSnsCard } from "./sns-card.js";
import { canShareSnsCard, createSnsCardFilename, downloadSnsCard, generateSnsCardJpeg, shareSnsCardFile } from "./sns-card-export.js";
import { applySnsPhotoAdjustmentToLogs, normalizeSnsPhotoAdjustment, SNS_PHOTO_ADJUSTMENT_DEFAULTS } from "./sns-photo-adjustment.js";
import { resetCatchForm } from "./catch-form.js";
import { updateFishingLog } from "./log-editor.js";

const elements = {
  catchFormCard: document.getElementById("catchFormCard"),
  formKicker: document.getElementById("formKicker"),
  formHeading: document.getElementById("formHeading"),
  editModeStatus: document.getElementById("editModeStatus"),
  editCancelButton: document.getElementById("editCancelButton"),
  saveButton: document.getElementById("saveButton"),
  fishingPlace: document.getElementById("fishingPlace"),
  fishName: document.getElementById("fishName"),
  fishSize: document.getElementById("fishSize"),
  fishingMethod: document.getElementById("fishingMethod"),
  memo: document.getElementById("memo"),
  catchPhoto: document.getElementById("catchPhoto"),
  photoSelection: document.getElementById("photoSelection"),
  photoSelectionPreview: document.getElementById("photoSelectionPreview"),
  photoSelectionName: document.getElementById("photoSelectionName"),
  photoRemoveButton: document.getElementById("photoRemoveButton"),
  photoError: document.getElementById("photoError"),
  locationButton: document.getElementById("locationButton"),
  locationText: document.getElementById("locationText"),
  weatherText: document.getElementById("weatherText"),
  refreshStatus: document.getElementById("refreshStatus"),
  resultArea: document.getElementById("resultArea"),
  detailDialog: document.getElementById("catchDetailDialog"),
  detailTitle: document.getElementById("detailTitle"),
  detailContent: document.getElementById("detailContent"),
  detailCloseButton: document.getElementById("detailCloseButton"),
  detailDoneButton: document.getElementById("detailDoneButton"),
  snsDialog: document.getElementById("snsCardDialog"),
  snsPreview: document.getElementById("snsCardPreview"),
  snsControls: document.getElementById("snsCardControls"),
  snsCloseButton: document.getElementById("snsCloseButton"),
  snsDoneButton: document.getElementById("snsDoneButton"),
  snsSaveButton: document.getElementById("snsSaveButton"),
  snsShareButton: document.getElementById("snsShareButton"),
  snsActionStatus: document.getElementById("snsActionStatus"),
  snsPhotoScale: document.getElementById("snsPhotoScale"),
  snsPhotoScaleValue: document.getElementById("snsPhotoScaleValue"),
  snsPhotoResetButton: document.getElementById("snsPhotoResetButton"),
  tide: {
    panel: document.getElementById("tidePanel"),
    status: document.getElementById("tideStatus"),
    level: document.getElementById("tideLevel"),
    next: document.getElementById("nextTide"),
    station: document.getElementById("tideStation"),
    graph: document.getElementById("tideGraph"),
    extremes: document.getElementById("tideExtremes"),
    source: document.getElementById("tideSource")
  }
};

let currentTemperature = "";
let currentWeather = "";
let currentTideDay = null;
let selectedPhotoFile = null;
let selectedPhotoPreviewUrl = "";
let detailPhotoUrl = "";
let activeDetailLog = null;
let detailOpening = false;
let snsPhotoAdjustment = { ...SNS_PHOTO_ADJUSTMENT_DEFAULTS };
const snsPhotoPointers = new Map();
let snsPhotoGesture = null;
let environmentRefreshId = 0;
let editingLogId = "";
let editPhotoAction = "keep";

function loadFishingLogs() {
  try {
    const stored = JSON.parse(localStorage.getItem("fishingLogs") || "[]");
    const normalized = ensureLogIds(stored);
    if (normalized.changed) {
      try {
        persistFishingLogs(normalized.logs);
      } catch (error) {
        console.warn("既存釣果のIDを保存できませんでした。今回の表示中のみIDを補完します", error);
      }
    }
    return normalized.logs;
  } catch (error) {
    console.warn("保存済み釣果を読み込めませんでした", error);
    return [];
  }
}

let fishingLogs = loadFishingLogs();

function persistFishingLogs(logs) {
  localStorage.setItem("fishingLogs", JSON.stringify(logs));
}

function addLine(container, label, value) {
  const line = document.createElement("p");
  const name = document.createElement("span");
  name.className = "log-label";
  name.textContent = `${label} `;
  line.append(name, document.createTextNode(value));
  container.append(line);
}

function showLogs() {
  elements.resultArea.replaceChildren();
  if (fishingLogs.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "最初の釣果を記録してみましょう。";
    elements.resultArea.append(empty);
    return;
  }

  fishingLogs.forEach((log, index) => {
    const card = document.createElement("article");
    card.className = "result-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `${log.name || "魚種未記録"}の釣果詳細を開く`);
    const header = document.createElement("div");
    header.className = "result-card-header";
    const title = document.createElement("h3");
    title.textContent = log.name || "魚種未記録";
    const date = document.createElement("time");
    date.textContent = `${log.date || "日付未記録"} ${log.time || ""}`;
    header.append(title, date);
    card.append(header);

    addLine(card, "場所", log.place || "未記録");
    if (log.size) addLine(card, "サイズ", `${log.size} cm`);
    if (log.method) addLine(card, "釣り方", log.method);
    if (log.weather || log.temperature) addLine(card, "天気", `${log.weather || "未記録"} ${log.temperature ? `${log.temperature}℃` : ""}`.trim());
    if (log.tide) {
      const tideText = [log.tide.tideCycle, log.tide.trendLabel].filter(Boolean).join("・");
      if (tideText) addLine(card, "潮", tideText);
    }
    if (log.memo) addLine(card, "メモ", log.memo);

    const deleteButton = document.createElement("button");
    deleteButton.className = "button button-danger";
    deleteButton.type = "button";
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteButton.disabled = true;
      void deleteLog(index).finally(() => {
        if (deleteButton.isConnected) deleteButton.disabled = false;
      });
    });
    card.append(deleteButton);
    card.addEventListener("click", () => openCatchDetail(log));
    card.addEventListener("keydown", (event) => {
      if (event.target !== card) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCatchDetail(log);
      }
    });
    elements.resultArea.append(card);
  });
}

async function openCatchDetail(log) {
  if (elements.detailDialog.open || detailOpening) return;
  detailOpening = true;
  activeDetailLog = log;
  releaseDetailPhotoUrl();
  let photoUrl = "";
  if (log.photoId) {
    try {
      const photo = await getPhoto(log.photoId);
      if (photo?.blob) {
        photoUrl = URL.createObjectURL(photo.blob);
        detailPhotoUrl = photoUrl;
      }
    } catch (error) {
      console.warn("保存済み写真を読み込めませんでした", error);
    }
  }
  try {
    renderCatchDetail(elements.detailContent, elements.detailTitle, log, {
      photoUrl,
      onCreateCard: () => openSnsCard(log),
      onEdit: () => startEditingLog(log)
    });
    elements.detailDialog.showModal();
  } finally {
    detailOpening = false;
  }
}

function closeCatchDetail() {
  elements.detailDialog.close();
}

elements.detailCloseButton.addEventListener("click", closeCatchDetail);
elements.detailDoneButton.addEventListener("click", closeCatchDetail);
elements.detailDialog.addEventListener("click", (event) => {
  if (event.target === elements.detailDialog) closeCatchDetail();
});
elements.detailDialog.addEventListener("close", () => {
  releaseDetailPhotoUrl();
  activeDetailLog = null;
});

function releaseDetailPhotoUrl() {
  if (!detailPhotoUrl) return;
  URL.revokeObjectURL(detailPhotoUrl);
  detailPhotoUrl = "";
}

async function deleteLog(index) {
  const log = fishingLogs[index];
  if (!log) return;
  let photoRecord = null;
  try {
    if (log.photoId) {
      photoRecord = await getPhoto(log.photoId);
      await deletePhoto(log.photoId);
    }
    const nextLogs = fishingLogs.filter((_item, itemIndex) => itemIndex !== index);
    persistFishingLogs(nextLogs);
    fishingLogs = nextLogs;
    showLogs();
  } catch (error) {
    if (photoRecord) {
      try {
        await savePhoto(photoRecord);
      } catch (restoreError) {
        console.error("削除失敗後に写真を復元できませんでした", restoreError);
      }
    }
    alert("釣果を削除できませんでした。時間をおいて再試行してください");
    console.error("釣果の削除に失敗しました", error);
  }
}

elements.saveButton.addEventListener("click", async () => {
  const name = elements.fishName.value.trim();
  if (!name) {
    alert("魚種を入力してください");
    elements.fishName.focus();
    return;
  }

  if (editingLogId) {
    await saveEditedLog();
    return;
  }

  const now = new Date();
  const logId = createUuid();
  let photoId = "";
  let processedPhoto = null;
  hidePhotoError();
  elements.saveButton.disabled = true;

  if (selectedPhotoFile) {
    try {
      processedPhoto = await resizePhoto(selectedPhotoFile);
      photoId = createUuid();
      await savePhoto({
        id: photoId,
        logId,
        blob: processedPhoto.blob,
        width: processedPhoto.width,
        height: processedPhoto.height,
        type: processedPhoto.type,
        originalName: processedPhoto.originalName,
        createdAt: now.toISOString()
      });
    } catch (error) {
      showPhotoError(error.message || "写真を保存できませんでした。写真を外して再試行してください");
      elements.saveButton.disabled = false;
      return;
    }
  }

  let tide = null;
  if (currentTideDay) {
    try {
      tide = createTideSnapshot(currentTideDay, now);
    } catch (error) {
      console.warn("潮汐情報なしで釣果を保存します", error);
    }
  }

  const log = {
    id: logId,
    date: now.toLocaleDateString("ja-JP"),
    time: now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
    place: elements.fishingPlace.value.trim(),
    temperature: currentTemperature,
    windSpeed: "",
    weather: currentWeather,
    name,
    size: elements.fishSize.value,
    method: elements.fishingMethod.value.trim(),
    memo: elements.memo.value.trim(),
    tide,
    ...(photoId ? {
      photoId,
      photo: {
        width: processedPhoto.width,
        height: processedPhoto.height,
        type: processedPhoto.type
      }
    } : {})
  };

  const nextLogs = [log, ...fishingLogs];
  try {
    persistFishingLogs(nextLogs);
  } catch (error) {
    if (photoId) {
      try {
        await deletePhoto(photoId);
      } catch (rollbackError) {
        console.error("釣果保存失敗後に写真を削除できませんでした", rollbackError);
      }
    }
    showPhotoError("釣果を保存できませんでした。端末の空き容量を確認してください");
    elements.saveButton.disabled = false;
    return;
  }
  fishingLogs = nextLogs;
  showLogs();
  resetCatchForm(elements, clearSelectedPhoto);
  resetEnvironmentState();
  elements.saveButton.disabled = false;
  elements.fishName.focus();
  void refreshEnvironment();
});

elements.catchPhoto.addEventListener("change", () => {
  const file = elements.catchPhoto.files?.[0] || null;
  clearSelectedPhotoPreview();
  hidePhotoError();
  selectedPhotoFile = file;
  if (editingLogId && file) editPhotoAction = "replace";
  if (!file) {
    elements.photoSelection.hidden = true;
    return;
  }
  selectedPhotoPreviewUrl = URL.createObjectURL(file);
  elements.photoSelectionPreview.src = selectedPhotoPreviewUrl;
  elements.photoSelectionName.textContent = file.name || "選択した写真";
  elements.photoSelection.hidden = false;
});

elements.photoRemoveButton.addEventListener("click", clearSelectedPhoto);

function clearSelectedPhotoPreview() {
  if (selectedPhotoPreviewUrl) URL.revokeObjectURL(selectedPhotoPreviewUrl);
  selectedPhotoPreviewUrl = "";
  elements.photoSelectionPreview.removeAttribute("src");
}

function clearSelectedPhoto() {
  if (editingLogId) editPhotoAction = "remove";
  clearSelectedPhotoPreview();
  selectedPhotoFile = null;
  elements.catchPhoto.value = "";
  elements.photoSelectionName.textContent = "";
  elements.photoSelection.hidden = true;
  hidePhotoError();
}

async function startEditingLog(log) {
  closeCatchDetail();
  clearSelectedPhoto();
  editingLogId = log.id;
  editPhotoAction = "keep";
  elements.fishingPlace.value = log.place ?? "";
  elements.fishName.value = log.name ?? "";
  elements.fishSize.value = log.size ?? "";
  elements.fishingMethod.value = log.method ?? "";
  elements.memo.value = log.memo ?? "";
  elements.catchFormCard.classList.add("is-editing");
  elements.formKicker.textContent = "EDIT CATCH";
  elements.formHeading.textContent = "釣果ログを編集";
  elements.editModeStatus.hidden = false;
  elements.editCancelButton.hidden = false;
  elements.saveButton.textContent = "変更を保存";
  elements.locationButton.disabled = true;
  elements.locationText.textContent = "保存時の位置情報を維持します";
  elements.weatherText.textContent = "保存時の天気・潮情報を維持します";
  environmentRefreshId += 1;

  if (log.photoId) {
    try {
      const photo = await getPhoto(log.photoId);
      if (editingLogId !== log.id || !photo?.blob) return;
      selectedPhotoPreviewUrl = URL.createObjectURL(photo.blob);
      elements.photoSelectionPreview.src = selectedPhotoPreviewUrl;
      elements.photoSelectionName.textContent = "現在の写真（変更しない場合は維持）";
      elements.photoSelection.hidden = false;
    } catch (error) {
      showPhotoError("現在の写真を読み込めませんでした。写真を変更せずに保存できます。");
      console.error("編集用写真の読み込みに失敗しました", error);
    }
  }
  elements.catchFormCard.scrollIntoView({ behavior: "smooth", block: "start" });
  elements.fishName.focus();
}

async function saveEditedLog() {
  hidePhotoError();
  elements.saveButton.disabled = true;
  elements.editCancelButton.disabled = true;
  try {
    const result = await updateFishingLog({
      logs: fishingLogs,
      targetId: editingLogId,
      values: {
        place: elements.fishingPlace.value.trim(),
        name: elements.fishName.value.trim(),
        size: elements.fishSize.value,
        method: elements.fishingMethod.value.trim(),
        memo: elements.memo.value.trim()
      },
      photoChange: editPhotoAction === "replace"
        ? { type: "replace", file: selectedPhotoFile }
        : { type: editPhotoAction },
      resizePhoto, createUuid, getPhoto, savePhoto, deletePhoto,
      persistLogs: persistFishingLogs
    });
    fishingLogs = result.logs;
    showLogs();
    leaveEditMode();
    elements.fishName.focus();
    void refreshEnvironment();
  } catch (error) {
    showPhotoError(error?.message || "変更を保存できませんでした。元のログは維持されています。");
    console.error("釣果ログの編集保存に失敗しました", error);
  } finally {
    elements.saveButton.disabled = false;
    elements.editCancelButton.disabled = false;
  }
}

function leaveEditMode() {
  editingLogId = "";
  editPhotoAction = "keep";
  resetCatchForm(elements, clearSelectedPhoto);
  elements.catchFormCard.classList.remove("is-editing");
  elements.formKicker.textContent = "NEW CATCH";
  elements.formHeading.textContent = "釣果を記録";
  elements.editModeStatus.hidden = true;
  elements.editCancelButton.hidden = true;
  elements.saveButton.textContent = "この釣果を保存";
  elements.locationButton.disabled = false;
  resetEnvironmentState();
}

elements.editCancelButton.addEventListener("click", () => {
  leaveEditMode();
  elements.fishName.focus();
  void refreshEnvironment();
});

function showPhotoError(message) {
  elements.photoError.textContent = message;
  elements.photoError.hidden = false;
}

function hidePhotoError() {
  elements.photoError.textContent = "";
  elements.photoError.hidden = true;
}

function getSnsVisibility() {
  return Object.fromEntries(
    [...elements.snsControls.querySelectorAll('input[type="checkbox"]')]
      .map((input) => [input.name, input.checked])
  );
}

function resetSnsVisibility() {
  [...elements.snsControls.querySelectorAll('input[type="checkbox"]')].forEach((input) => {
    input.checked = SNS_CARD_DEFAULTS[input.name];
  });
}

function openSnsCard(log) {
  if (!detailPhotoUrl || !log.photoId) {
    alert("カード作成には写真が必要です。新しい釣果を写真付きで保存してください");
    return;
  }
  if (elements.snsDialog.open) return;
  resetSnsVisibility();
  snsPhotoAdjustment = normalizeSnsPhotoAdjustment(log.snsPhotoAdjustment);
  updateSnsPhotoScaleControl();
  renderSnsCard(elements.snsPreview, log, detailPhotoUrl, getSnsVisibility(), snsPhotoAdjustment);
  setSnsActionStatus("");
  elements.snsShareButton.hidden = false;
  elements.snsDialog.showModal();
}

function closeSnsCard() {
  elements.snsDialog.close();
}

elements.snsControls.addEventListener("change", () => {
  if (!activeDetailLog || !detailPhotoUrl) return;
  renderSnsCard(elements.snsPreview, activeDetailLog, detailPhotoUrl, getSnsVisibility(), snsPhotoAdjustment);
});
elements.snsCloseButton.addEventListener("click", closeSnsCard);
elements.snsDoneButton.addEventListener("click", closeSnsCard);
elements.snsSaveButton.addEventListener("click", () => runSnsAction("save"));
elements.snsShareButton.addEventListener("click", () => runSnsAction("share"));
elements.snsDialog.addEventListener("click", (event) => {
  if (event.target === elements.snsDialog) closeSnsCard();
});

function getSnsPhotoCanvas() {
  return elements.snsPreview.querySelector(".sns-card-photo");
}

function updateSnsPhotoScaleControl() {
  const percent = Math.round(snsPhotoAdjustment.scale * 100);
  elements.snsPhotoScale.value = String(percent);
  elements.snsPhotoScaleValue.value = `${percent}%`;
  elements.snsPhotoScaleValue.textContent = `${percent}%`;
}

function redrawActiveSnsPhoto() {
  redrawSnsCardPhoto(getSnsPhotoCanvas(), snsPhotoAdjustment);
  updateSnsPhotoScaleControl();
}

function saveSnsPhotoAdjustment() {
  if (!activeDetailLog?.id) return;
  const adjustment = normalizeSnsPhotoAdjustment(snsPhotoAdjustment);
  const { logs: nextLogs, updatedLog } = applySnsPhotoAdjustmentToLogs(fishingLogs, activeDetailLog.id, adjustment);
  if (!updatedLog) return;
  try {
    persistFishingLogs(nextLogs);
    fishingLogs = nextLogs;
    activeDetailLog = updatedLog;
    snsPhotoAdjustment = adjustment;
    setSnsActionStatus("写真の調整内容を保存しました。");
  } catch (error) {
    setSnsActionStatus("写真の調整内容を保存できませんでした。端末の空き容量をご確認ください。", true);
    console.error("SNSカードの写真調整を保存できませんでした", error);
  }
}

function pointerDistance(points) {
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

elements.snsPreview.addEventListener("pointerdown", (event) => {
  if (!event.target.classList.contains("sns-card-photo")) return;
  event.preventDefault();
  event.target.setPointerCapture(event.pointerId);
  snsPhotoPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const points = [...snsPhotoPointers.values()];
  snsPhotoGesture = points.length >= 2
    ? { type: "pinch", distance: pointerDistance(points.slice(0, 2)), scale: snsPhotoAdjustment.scale }
    : { type: "drag", x: event.clientX, y: event.clientY, adjustment: { ...snsPhotoAdjustment } };
});

elements.snsPreview.addEventListener("pointermove", (event) => {
  if (!snsPhotoPointers.has(event.pointerId) || !snsPhotoGesture) return;
  event.preventDefault();
  snsPhotoPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const points = [...snsPhotoPointers.values()];
  if (points.length >= 2 && snsPhotoGesture.type === "pinch") {
    const distance = pointerDistance(points.slice(0, 2));
    snsPhotoAdjustment = normalizeSnsPhotoAdjustment({
      ...snsPhotoAdjustment,
      scale: snsPhotoGesture.scale * (distance / Math.max(1, snsPhotoGesture.distance))
    });
  } else if (points.length === 1 && snsPhotoGesture.type === "drag") {
    const bounds = getSnsPhotoCanvas().getBoundingClientRect();
    snsPhotoAdjustment = normalizeSnsPhotoAdjustment({
      ...snsPhotoAdjustment,
      x: snsPhotoGesture.adjustment.x - ((event.clientX - snsPhotoGesture.x) * 2 / Math.max(1, bounds.width)),
      y: snsPhotoGesture.adjustment.y - ((event.clientY - snsPhotoGesture.y) * 2 / Math.max(1, bounds.height))
    });
  }
  redrawActiveSnsPhoto();
});

function finishSnsPhotoPointer(event) {
  if (!snsPhotoPointers.has(event.pointerId)) return;
  snsPhotoPointers.delete(event.pointerId);
  const point = [...snsPhotoPointers.values()][0];
  snsPhotoGesture = point ? { type: "drag", x: point.x, y: point.y, adjustment: { ...snsPhotoAdjustment } } : null;
  saveSnsPhotoAdjustment();
}

elements.snsPreview.addEventListener("pointerup", finishSnsPhotoPointer);
elements.snsPreview.addEventListener("pointercancel", finishSnsPhotoPointer);

elements.snsPhotoScale.addEventListener("input", () => {
  snsPhotoAdjustment = normalizeSnsPhotoAdjustment({ ...snsPhotoAdjustment, scale: Number(elements.snsPhotoScale.value) / 100 });
  redrawActiveSnsPhoto();
});
elements.snsPhotoScale.addEventListener("change", saveSnsPhotoAdjustment);
elements.snsPhotoResetButton.addEventListener("click", () => {
  snsPhotoAdjustment = { ...SNS_PHOTO_ADJUSTMENT_DEFAULTS };
  redrawActiveSnsPhoto();
  saveSnsPhotoAdjustment();
});

function setSnsActionStatus(message, isError = false) {
  elements.snsActionStatus.textContent = message;
  elements.snsActionStatus.classList.toggle("sns-action-error", isError);
}

async function createActiveSnsFile() {
  if (!activeDetailLog || !detailPhotoUrl) throw new Error("カードの写真を読み込めませんでした");
  const exportLog = { ...activeDetailLog, snsPhotoAdjustment: normalizeSnsPhotoAdjustment(snsPhotoAdjustment) };
  const blob = await generateSnsCardJpeg(exportLog, detailPhotoUrl, getSnsVisibility());
  const filename = createSnsCardFilename(activeDetailLog);
  return { blob, filename, file: new File([blob], filename, { type: blob.type }) };
}

async function runSnsAction(action) {
  const button = action === "share" ? elements.snsShareButton : elements.snsSaveButton;
  button.disabled = true;
  setSnsActionStatus("共有用JPEG画像を作成しています…");
  try {
    const { blob, filename, file } = await createActiveSnsFile();
    if (action === "share") {
      if (!canShareSnsCard(navigator, file)) {
        setSnsActionStatus("この環境では画像共有に対応していません。「JPEGを保存」から保存してSNSで選択してください。", true);
        return;
      }
      await shareSnsCardFile(navigator, file, { title: "Fishing Log", text: `${activeDetailLog.name || "釣果"}の釣果カード` });
      setSnsActionStatus("共有操作が完了しました。");
    } else {
      downloadSnsCard(blob, filename);
      setSnsActionStatus("JPEG画像を保存しました。保存先はブラウザや端末によりダウンロードまたはファイル領域になります。");
    }
  } catch (error) {
    if (action === "share" && error?.name === "AbortError") {
      setSnsActionStatus("共有をキャンセルしました。");
    } else {
      const reason = error?.message ? `（${error.message}）` : "";
      setSnsActionStatus(action === "share"
        ? `共有できませんでした${reason}。「JPEGを保存」から保存してSNSで選択してください。`
        : `JPEG画像を保存できませんでした${reason}。`, true);
      console.error(`SNSカードの${action === "share" ? "共有" : "保存"}に失敗しました`, error);
    }
  } finally {
    button.disabled = false;
  }
}

elements.locationButton.addEventListener("click", () => {
  void refreshEnvironment();
});

function resetEnvironmentState() {
  currentTemperature = "";
  currentWeather = "";
  currentTideDay = null;
  elements.locationText.textContent = "緯度経度：未取得";
  elements.weatherText.textContent = "天気：未取得";
}

function setRefreshStatus(message = "") {
  elements.refreshStatus.textContent = message;
  elements.refreshStatus.hidden = !message;
}

function refreshEnvironment() {
  const refreshId = ++environmentRefreshId;
  elements.fishingPlace.value = "";
  currentTemperature = "";
  currentWeather = "";
  elements.weatherText.textContent = "天気：取得中…";
  elements.locationButton.disabled = true;
  elements.locationText.textContent = "現在地を取得しています…";
  setRefreshStatus("現在地・天気・潮情報を更新しています… 入力は続けられます。");
  const tidePromise = initializeTide();

  if (!navigator.geolocation) {
    handleLocationFailure(refreshId);
    return tidePromise.finally(() => finishEnvironmentRefresh(refreshId));
  }
  return new Promise((resolve) => navigator.geolocation.getCurrentPosition(
    async (position) => {
      if (refreshId !== environmentRefreshId) return resolve();
      const latitude = position.coords.latitude.toFixed(4);
      const longitude = position.coords.longitude.toFixed(4);
      elements.locationText.textContent = `緯度 ${latitude} / 経度 ${longitude}`;
      await Promise.allSettled([getPlaceName(latitude, longitude), getWeather(latitude, longitude)]);
      await tidePromise;
      finishEnvironmentRefresh(refreshId);
      resolve();
    },
    () => {
      handleLocationFailure(refreshId);
      tidePromise.finally(() => {
        finishEnvironmentRefresh(refreshId);
        resolve();
      });
    },
    { timeout: 10000, maximumAge: 300000 }
  ));
}

function handleLocationFailure(refreshId) {
  if (refreshId !== environmentRefreshId) return;
  elements.fishingPlace.value = "";
  currentTemperature = "";
  currentWeather = "";
  elements.locationText.textContent = "現在地を取得できませんでした。場所を手入力してください。";
  elements.weatherText.textContent = "天気：情報なし（入力と保存は続けられます）";
}

function finishEnvironmentRefresh(refreshId) {
  if (refreshId !== environmentRefreshId) return;
  elements.locationButton.disabled = false;
  setRefreshStatus();
}

async function getWeather(latitude, longitude) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    currentTemperature = data.current.temperature_2m;
    currentWeather = weatherLabel(data.current.weather_code);
    elements.weatherText.textContent = `天気：${currentWeather} / ${currentTemperature}℃`;
  } catch (error) {
    currentTemperature = "";
    currentWeather = "";
    elements.weatherText.textContent = "天気を取得できませんでした。入力と保存は続けられます。";
  }
}

function weatherLabel(code) {
  if (code === 0) return "晴れ";
  if (code <= 2) return "晴れ時々曇り";
  if (code === 3) return "曇り";
  if (code === 45 || code === 48) return "霧";
  if (code >= 71 && code <= 77) return "雪";
  if (code >= 95) return "雷雨";
  if (code >= 51) return "雨";
  return "不明";
}

async function getPlaceName(latitude, longitude) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=ja`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const address = data.address || {};
    elements.fishingPlace.value = address.hamlet || address.neighbourhood || address.suburb || address.town || address.village || address.city || address.county || data.display_name || "";
  } catch (error) {
    elements.locationText.textContent += " / 地名は手入力してください";
  }
}

async function initializeTide() {
  const provider = new KureTideProvider();
  try {
    currentTideDay = await provider.getTideDay({ date: new Date() });
    renderTidePanel(elements.tide, currentTideDay, new Date());
  } catch (error) {
    currentTideDay = null;
    renderTideError(elements.tide, error);
  }
}

showLogs();
void initializeTide();
