import { useEffect, useRef, useState } from 'react';
import { furnitureGenerationRequest, readFurnitureImages, runFurnitureGeneration, validateFurnitureImages } from '../utils/furniture-generation';

const initial = () => ({ images: [], name: '', reading: false, busy: false,
  phase: 'idle', progress: null, error: '', message: '' });

// useRoomPlannerの内部状態として使用し、画像や処理状況は配置の保存・共有へ渡さない。
export function useFurnitureGeneration({ generate, readModel, cancelModel, workspaceMode, status, planKey, customPlan }) {
  const [state, setState] = useState(initial);
  const current = useRef(state); current.current = state;
  const images = useRef([]), reading = useRef(null), running = useRef(null);
  const cancelModelRef = useRef(cancelModel); cancelModelRef.current = cancelModel;
  const releaseImages = () => {
    images.current.forEach(image => URL.revokeObjectURL(image.url)); images.current = [];
  };
  const stop = () => {
    reading.current?.abort(); reading.current = null;
    if (running.current) { running.current.abort(); running.current = null; cancelModelRef.current(); }
  };
  const reset = () => { stop(); releaseImages(); setState(initial()); };
  useEffect(() => {
    reset();
    return () => { stop(); releaseImages(); };
  }, [workspaceMode, status, planKey, customPlan]);

  const addImages = async files => {
    if (running.current || status !== 'local') return;
    reading.current?.abort();
    const controller = new AbortController(); reading.current = controller;
    try {
      validateFurnitureImages(files, images.current.length);
      setState(previous => ({ ...previous, reading: true, error: '', message: '' }));
      const added = await readFurnitureImages(files, controller.signal);
      if (controller.signal.aborted) { added.forEach(image => URL.revokeObjectURL(image.url)); return; }
      images.current = [...images.current, ...added];
      setState(previous => ({ ...previous, images: images.current, reading: false, phase: 'idle',
        name: previous.name || files[0].name.replace(/\.[^.]+$/, '').slice(0, 80) }));
    } catch (error) {
      if (!controller.signal.aborted) setState(previous => ({ ...previous, reading: false, error: error.message }));
    } finally { if (reading.current === controller) reading.current = null; }
  };
  const removeImage = index => {
    if (running.current || reading.current) return;
    const removed = images.current[index]; if (!removed) return;
    URL.revokeObjectURL(removed.url);
    images.current = images.current.filter((_, value) => value !== index);
    setState(previous => ({ ...previous, images: images.current, phase: 'idle', error: '', message: '' }));
  };
  const update = patch => {
    if (running.current) return;
    setState(previous => ({ ...previous, ...patch, phase: 'idle', error: '', message: '' }));
  };
  const cancel = () => {
    stop();
    setState(previous => ({ ...previous, busy: false, reading: false, phase: 'idle', progress: null,
      message: '処理を中止しました。入力内容は残っています。', error: '' }));
  };
  const start = async () => {
    if (running.current || reading.current || status !== 'local') return;
    const controller = new AbortController(); running.current = controller;
    setState(previous => ({ ...previous, busy: true, phase: 'queued', progress: null, error: '', message: '' }));
    try {
      const request = { ...current.current, images: images.current.map(image => image.file) };
      const result = await runFurnitureGeneration(generate, request, {
        signal: controller.signal,
        onProgress: value => setState(previous => ({ ...previous, ...value })),
      });
      controller.signal.throwIfAborted();
      setState(previous => ({ ...previous, phase: 'importing', progress: null }));
      const loaded = await readModel(result.file, { ...result.metadata, source: 'generated' }, controller.signal);
      if (controller.signal.aborted) return;
      setState(previous => ({ ...previous, busy: false, phase: loaded ? 'ready' : 'failed',
        message: loaded ? '下のプレビューでモデルを確認し、「この家具を配置」を押してください。' : '',
        error: loaded ? '' : 'モデルを取り込めませんでした。下の取り込み欄で詳細を確認してください。' }));
    } catch (error) {
      if (!controller.signal.aborted) setState(previous => ({ ...previous, busy: false, phase: 'failed', error: error.message }));
    } finally { if (running.current === controller) running.current = null; }
  };
  let valid = false;
  try { furnitureGenerationRequest({ ...state, images: state.images.map(image => image.file) }); valid = true; } catch { /* 入力途中 */ }
  return { state, addImages, removeImage, update, cancel, reset, start, valid };
}
