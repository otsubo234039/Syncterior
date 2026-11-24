export const MODEL_UP_AXES = ['y', 'z', 'x', '-y', '-z', '-x'];
export const MODEL_FIELDS = ['assetId', 'modelUp', 'modelFront'];
export const hasImportedFurniture = room => room.items.some(item => item.type === 'model');
export const isModelReference = item => /^[a-f0-9]{64}$/.test(item.assetId)
  && MODEL_UP_AXES.includes(item.modelUp) && Number.isInteger(item.modelFront)
  && item.modelFront >= 0 && item.modelFront <= 3;
export const localRoomVersion = room => hasImportedFurniture(room) ? 3 : room.planKey === 'custom' ? 2 : 1;

export function modelDimensionsValid(item) {
  return ['w', 'd', 'h'].every(key => Number.isFinite(item[key]) && item[key] >= .02 && item[key] <= 20);
}
