import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { loadFurnitureAsset } from '../utils/furniture-asset-storage';
import { disposeFurnitureInstance, disposeFurnitureModel, fitFurnitureModel, loadFurnitureModel } from '../utils/furniture-model';

export function ImportedFurnitureModel({ item }) {
  const [model, setModel] = useState(null), [error, setError] = useState('');
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    const controller = new AbortController(); let owned;
    setModel(null); setError('');
    loadFurnitureAsset(item.assetId).then(bytes => loadFurnitureModel(bytes, controller.signal)).then(result => {
      if (controller.signal.aborted) { disposeFurnitureModel(result.scene); return; }
      owned = result.scene; setModel(owned); invalidate();
    }).catch(reason => {
      if (!controller.signal.aborted) { setError(reason.message); invalidate(); }
    });
    return () => { controller.abort(); if (owned) disposeFurnitureModel(owned); };
  }, [item.assetId, invalidate]);
  const object = useMemo(() => model && fitFurnitureModel(model, item), [model, item.w, item.d, item.h, item.modelUp, item.modelFront, item.color]);
  useLayoutEffect(() => {
    invalidate();
    return () => { if (object) disposeFurnitureInstance(object); };
  }, [object, invalidate]);
  return object ? <primitive object={object} dispose={null} /> : <>
    <mesh position={[0, item.h/2, 0]}><boxGeometry args={[item.w,item.h,item.d]} /><meshBasicMaterial color={error ? '#a86833' : '#829586'} wireframe /></mesh>
    {error && <Html position={[0,item.h + .1,0]} center><p className="model-load-error" role="status">{item.name}: {error}</p></Html>}
  </>;
}
