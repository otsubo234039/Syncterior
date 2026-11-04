import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { Ruler, Trash2 } from 'lucide-react';
import { Room } from './room';
export function PlannerCanvas({
  planKey,
  plan,
  items,
  selected,
  setSelected,
  moveItem,
  showSizes,
  toggleSizes,
  removeSelected
}) {
  return <div className="canvas-wrap"><Canvas shadows camera={{
      position: [8, 7, 9],
      fov: 42
    }} onPointerMissed={() => setSelected(null)}>
      <color attach="background" args={['#f1f0eb']} /><ambientLight intensity={1.4} /><directionalLight position={[5, 9, 4]} intensity={2.2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} /><Room planKey={planKey} items={items} selected={selected} setSelected={setSelected} moveItem={moveItem} /><OrbitControls makeDefault target={[0, .5, 0]} minDistance={5} maxDistance={16} maxPolarAngle={Math.PI * .49} /><Environment preset="apartment" />
    </Canvas>
    <div className="canvas-label"><span className="live-dot" /> LIVE 3D VIEW <span className="canvas-label-divider" /> ドラッグで視点を変更</div>
    <div className="canvas-tools"><button title="寸法表示" className={showSizes ? 'tool active' : 'tool'} onClick={toggleSizes}><Ruler size={17} /></button><button title="選択を削除" className="tool" onClick={removeSelected}><Trash2 size={17} /></button></div>
    {showSizes && <div className="dimension-tag width-tag">{plan.w.toFixed(1)} m</div>} {showSizes && <div className="dimension-tag depth-tag">{plan.d.toFixed(1)} m</div>}
    </div>;
}
