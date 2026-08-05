export function resetCatchForm(elements, clearSelectedPhoto) {
  elements.fishingPlace.value = "";
  elements.fishName.value = "";
  elements.fishSize.value = "";
  elements.fishingMethod.value = "";
  elements.memo.value = "";
  clearSelectedPhoto();
}
