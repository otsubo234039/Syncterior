import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, ContactShadows, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Armchair, BedDouble, Box, Lamp, Monitor, Refrigerator, Sofa, Tv, Trash2, RotateCw, Ruler, House } from 'lucide-react';
import './style.css';

const plans = {
  studio: { name: 'ワンルーム', w: 5.4, d: 4.2, h: 2.5, desc: '一人暮らし向け・22.7㎡', doors: [{x:1.8,z:2.1,w:.9}] },
  '1ldk': { name: '1LDK', w: 7.2, d: 5.4, h: 2.5, desc: '寝室とLDKを分けた間取り・38.9㎡', doors: [{x:2.5,z:2.7,w:.9}] },
  family: { name: 'ファミリー', w: 8.4, d: 6.6, h: 2.6, desc: 'ゆとりあるリビング・55.4㎡', doors: [{x:3,z:3.3,w:1}] }
};
const catalog = [
  {type:'sofa', name:'2人掛けソファ', w:1.6,d:.82,h:.78,color:'#9eab9a',icon:Sofa},
  {type:'bed', name:'ダブルベッド', w:1.4,d:2,h:.48,color:'#d5c7b5',icon:BedDouble},
  {type:'table', name:'ローテーブル', w:1.0,d:.55,h:.38,color:'#b88b62',icon:Box},
  {type:'desk', name:'デスク', w:1.2,d:.6,h:.74,color:'#b88b62',icon:Monitor},
  {type:'chair', name:'ダイニングチェア', w:.48,d:.5,h:.82,color:'#d1a879',icon:Armchair},
  {type:'tv', name:'テレビ台＋TV', w:1.2,d:.36,h:.72,color:'#5c6268',icon:Tv},
  {type:'fridge', name:'冷蔵庫', w:.62,d:.68,h:1.75,color:'#c9d1d4',icon:Refrigerator},
  {type:'lamp', name:'フロアランプ', w:.32,d:.32,h:1.55,color:'#d4b86c',icon:Lamp}
];
const uid=()=>Math.random().toString(36).slice(2,9);
function initialFurniture(planKey){
 const p=plans[planKey], x=p.w/2, z=p.d/2;
 return [
  {...catalog[0],id:uid(),x:-.7,z:-.5,rot:0},
  {...catalog[2],id:uid(),x:-.65,z:.55,rot:0},
  {...catalog[1],id:uid(),x:x*.48,z:-z*.52,rot:0},
  {...catalog[5],id:uid(),x:-.75,z:-z+0.28,rot:0}
 ];
}
function Furniture({item, selected, onSelect, onMove}){
 const group=React.useRef();
 const [dragging,setDragging]=useState(false);
 const shape = item.type;
 const color=item.color;
 const mats=(c)=> <meshStandardMaterial color={c} roughness={.78}/>;
 const parts=()=>{
  if(shape==='sofa') return <><mesh position={[0,.2,0]}><boxGeometry args={[item.w,.4,item.d]}/>{mats(color)}</mesh><mesh position={[0,.52,-item.d*.35]}><boxGeometry args={[item.w,.58,item.d*.3]}/>{mats(color)}</mesh>{[-.32,.32].map((x,i)=><mesh key={i} position={[x,.48,item.d*.12]}><boxGeometry args={[.12,.5,item.d*.78]}/>{mats(color)}</mesh>)}</>;
  if(shape==='bed') return <><mesh position={[0,.12,0]}><boxGeometry args={[item.w,.24,item.d]}/>{mats('#8b725c')}</mesh><mesh position={[0,.28,0]}><boxGeometry args={[item.w*.96,.12,item.d*.94]}/>{mats('#f0e9dc')}</mesh><mesh position={[-item.w*.24,.39,-item.d*.34]}><boxGeometry args={[item.w*.38,.12,.36]}/>{mats('#fffaf0')}</mesh><mesh position={[item.w*.24,.39,-item.d*.34]}><boxGeometry args={[item.w*.38,.12,.36]}/>{mats('#fffaf0')}</mesh></>;
  if(shape==='table'||shape==='desk') return <><mesh position={[0,item.h-.06,0]}><boxGeometry args={[item.w,.12,item.d]}/>{mats(color)}</mesh>{[-1,1].flatMap(a=>[-1,1].map(b=><mesh key={a+','+b} position={[a*(item.w/2-.08),item.h/2-.06,b*(item.d/2-.08)]}><boxGeometry args={[.07,item.h-.12,.07]}/>{mats('#8a6a4d')}</mesh>))}</>;
  if(shape==='chair') return <><mesh position={[0,.43,0]}><boxGeometry args={[item.w,.12,item.d]}/>{mats(color)}</mesh><mesh position={[0,.68,-item.d*.42]}><boxGeometry args={[item.w,.42,.09]}/>{mats(color)}</mesh>{[-1,1].flatMap(a=>[-1,1].map(b=><mesh key={a+','+b} position={[a*item.w*.38,.2,b*item.d*.38]}><boxGeometry args={[.045,.4,.045]}/>{mats('#8a6a4d')}</mesh>))}</>;
  if(shape==='tv') return <><mesh position={[0,.28,0]}><boxGeometry args={[item.w,.56,item.d]}/>{mats(color)}</mesh><mesh position={[0,.78,-.03]}><boxGeometry args={[item.w*.88,.52,.055]}/>{mats('#25292d')}</mesh><mesh position={[0,.78,.002]}><boxGeometry args={[item.w*.82,.44,.012]}/>{mats('#667b85')}</mesh></>;
  if(shape==='fridge') return <><mesh position={[0,item.h/2,0]}><boxGeometry args={[item.w,item.h,item.d]}/>{mats(color)}</mesh><mesh position={[item.w*.32,item.h*.54,item.d/2+.008]}><boxGeometry args={[.025,.07,.015]}/>{mats('#6f7a80')}</mesh><mesh position={[item.w*.32,item.h*.25,item.d/2+.008]}><boxGeometry args={[.025,.07,.015]}/>{mats('#6f7a80')}</mesh></>;
  return <><mesh position={[0,.04,0]}><cylinderGeometry args={[.16,.16,.08,24]}/>{mats(color)}</mesh><mesh position={[0,item.h*.52,0]}><cylinderGeometry args={[.025,.025,item.h*.92,12]}/>{mats('#77736a')}</mesh><mesh position={[0,item.h*.94,0]}><coneGeometry args={[.17,.2,24]}/>{mats(color)}</mesh></>;
 };
 return <group ref={group} position={[item.x,0,item.z]} rotation={[0,item.rot,0]} onClick={e=>{e.stopPropagation();onSelect(item.id)}} onPointerDown={e=>{e.stopPropagation();setDragging(true);e.target.setPointerCapture?.(e.pointerId)}} onPointerUp={()=>setDragging(false)} onPointerMove={e=>{if(dragging && e.buttons===1){e.stopPropagation();const p=e.point;onMove(item.id,p.x,p.z)}}}>
  {parts()}
  {selected&&<mesh position={[0,.015,0]}><boxGeometry args={[item.w+.12,.018,item.d+.12]}/><meshBasicMaterial color="#5b8f78" wireframe/></mesh>}
 </group>
}
function Room({planKey,items,selected,setSelected,moveItem}){
 const p=plans[planKey], wall=.09;
 return <group>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.04,0]} receiveShadow><planeGeometry args={[p.w,p.d]}/><meshStandardMaterial color="#e8e4dc" roughness={1}/></mesh>
  <Grid position={[0,-.025,0]} args={[p.w,p.d]} cellSize={.25} cellThickness={.45} sectionSize={1} sectionThickness={.8} fadeDistance={18} fadeStrength={1} cellColor="#c9c6bf" sectionColor="#aaa69e" infiniteGrid={false}/>
  {[
   {pos:[0,p.h/2,-p.d/2],size:[p.w,p.h,wall]},
   {pos:[-p.w/2,p.h/2,0],size:[wall,p.h,p.d]},
   {pos:[p.w/2,p.h/2,0],size:[wall,p.h,p.d]},
   {pos:[0,p.h/2,p.d/2],size:[p.w,p.h,wall]}
  ].map((w,i)=><mesh key={i} position={w.pos} castShadow><boxGeometry args={w.size}/><meshStandardMaterial color="#f7f4ed" roughness={.92} transparent opacity={.78}/></mesh>)}
  {items.map(item=><Furniture key={item.id} item={item} selected={selected===item.id} onSelect={setSelected} onMove={moveItem}/>)}
  <ContactShadows position={[0,-.02,0]} opacity={.22} scale={Math.max(p.w,p.d)*1.5} blur={2.5} far={3}/>
 </group>
}
function App(){
 const [planKey,setPlanKey]=useState('studio');
 const [items,setItems]=useState(()=>initialFurniture('studio'));
 const [selected,setSelected]=useState(null);
 const [showSizes,setShowSizes]=useState(true);
 const plan=plans[planKey], active=items.find(x=>x.id===selected);
 const changePlan=(key)=>{setPlanKey(key);setItems(initialFurniture(key));setSelected(null)};
 const addItem=(c)=>{const item={...c,id:uid(),x:0,z:0,rot:0};setItems(a=>[...a,item]);setSelected(item.id)};
 const update=(id,patch)=>setItems(a=>a.map(x=>x.id===id?{...x,...patch}:x));
 const moveItem=(id,x,z)=>{const halfW=plan.w/2,halfD=plan.d/2,item=items.find(a=>a.id===id);if(!item)return;update(id,{x:THREE.MathUtils.clamp(x,-halfW+item.w/2,halfW-item.w/2),z:THREE.MathUtils.clamp(z,-halfD+item.d/2,halfD-item.d/2)})};
 const rotate=()=>active&&update(active.id,{rot:active.rot+Math.PI/2});
 const totalArea=(plan.w*plan.d).toFixed(1);
 return <div className="app">
  <header><div className="brand"><div className="brand-mark"><House size={20}/></div><div><div className="brand-title">ROOM<span>/</span>PLAN</div><div className="brand-sub">3D INTERIOR SIMULATOR</div></div></div><div className="header-right"><span className="live-dot"/> 編集モード <span className="divider"/> <span className="save-label">プロトタイプ</span></div></header>
  <main>
   <aside className="sidebar">
    <div className="section-heading"><span className="step">01</span><div><h2>間取りを選ぶ</h2><p>部屋のベースを選択してください</p></div></div>
    <div className="plan-list">{Object.entries(plans).map(([key,p])=><button key={key} className={'plan-card '+(planKey===key?'chosen':'')} onClick={()=>changePlan(key)}>
      <div className="plan-sketch"><svg viewBox="0 0 100 70"><path d={key==='studio'?'M15 8 H85 V60 H15 Z':key==='1ldk'?'M8 8 H92 V62 H8 Z M55 8 V62 M8 38 H55':'M7 7 H93 V63 H7 Z M58 7 V63 M7 38 H58'} fill="none" stroke="currentColor" strokeWidth="2.5"/><path d={key==='studio'?'M45 60 H57':key==='1ldk'?'M45 62 H56 M55 22 H55':'M45 63 H56 M58 20 H58'} stroke="#5b8f78" strokeWidth="4"/></svg></div>
      <div className="plan-info"><strong>{p.name}</strong><span>{p.desc}</span><small>{p.w}m × {p.d}m</small></div><span className="radio-dot">{planKey===key?'✓':''}</span>
    </button>)}</div>
    <div className="section-heading furniture-heading"><span className="step">02</span><div><h2>家具・家電を追加</h2><p>選択すると部屋の中央に配置</p></div></div>
    <div className="catalog">{catalog.map(c=>{const Icon=c.icon;return <button key={c.type} className="catalog-item" onClick={()=>addItem(c)}><span className="catalog-icon"><Icon size={19}/></span><span className="catalog-name">{c.name}<small>{c.w} × {c.d} × {c.h} m</small></span><span className="add">＋</span></button>})}</div>
    <div className="sidebar-note"><span className="note-icon">i</span><span>家具はドラッグで移動、選択後に回転できます。寸法は一般的な製品の目安です。</span></div>
   </aside>
   <section className="workspace">
    <div className="workspace-top"><div><div className="eyebrow">YOUR SPACE</div><h1>{plan.name}<span> / 3Dレイアウト</span></h1><p>{plan.desc}</p></div><div className="room-metrics"><div><span>ROOM SIZE</span><strong>{totalArea}<small> m²</small></strong></div><div><span>FURNITURE</span><strong>{items.length}<small> 点</small></strong></div></div></div>
    <div className="canvas-wrap"><Canvas shadows camera={{position:[8,7,9],fov:42}} onPointerMissed={()=>setSelected(null)}>
      <color attach="background" args={['#f1f0eb']}/><ambientLight intensity={1.4}/><directionalLight position={[5,9,4]} intensity={2.2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048}/><Room planKey={planKey} items={items} selected={selected} setSelected={setSelected} moveItem={moveItem}/><OrbitControls makeDefault target={[0,.5,0]} minDistance={5} maxDistance={16} maxPolarAngle={Math.PI*.49}/><Environment preset="apartment"/>
    </Canvas>
    <div className="canvas-label"><span className="live-dot"/> LIVE 3D VIEW <span className="canvas-label-divider"/> ドラッグで視点を変更</div>
    <div className="canvas-tools"><button title="寸法表示" className={showSizes?'tool active':'tool'} onClick={()=>setShowSizes(!showSizes)}><Ruler size={17}/></button><button title="選択を削除" className="tool" onClick={()=>{if(selected){setItems(a=>a.filter(x=>x.id!==selected));setSelected(null)}}}><Trash2 size={17}/></button></div>
    {showSizes&&<div className="dimension-tag width-tag">{plan.w.toFixed(1)} m</div>} {showSizes&&<div className="dimension-tag depth-tag">{plan.d.toFixed(1)} m</div>}
    </div>
    <div className="workspace-bottom"><div className="hint"><span className="hint-key">TIP</span> 家具をクリックして選択、ドラッグして配置を調整</div><div className="controls-hint"><span>左ドラッグ：回転</span><span>スクロール：ズーム</span></div></div>
    <div className="properties">
      <div className="property-title"><div><div className="eyebrow">OBJECT SETTINGS</div><h3>{active?active.name:'家具を選択してください'}</h3></div>{active&&<button className="rotate-btn" onClick={rotate}><RotateCw size={15}/> 90° 回転</button>}</div>
      {active?<div className="property-grid">
        <label>幅 (W)<div className="value-box">{active.w.toFixed(2)} <small>m</small></div></label><label>奥行 (D)<div className="value-box">{active.d.toFixed(2)} <small>m</small></div></label><label>高さ (H)<div className="value-box">{active.h.toFixed(2)} <small>m</small></div></label>
        <label>左右位置 (X)<div className="value-box"><input type="number" step=".1" value={active.x.toFixed(1)} onChange={e=>update(active.id,{x:Math.max(-plan.w/2,Math.min(plan.w/2,Number(e.target.value)))})}/><small>m</small></div></label>
        <label>前後位置 (Z)<div className="value-box"><input type="number" step=".1" value={active.z.toFixed(1)} onChange={e=>update(active.id,{z:Math.max(-plan.d/2,Math.min(plan.d/2,Number(e.target.value)))})}/><small>m</small></div></label>
        <label>色<div className="value-box color-box"><input aria-label="家具の色" type="color" value={active.color} onChange={e=>update(active.id,{color:e.target.value})}/><span>{active.color.toUpperCase()}</span></div></label>
      </div>:<div className="empty-property">左のカタログから家具を追加するか、3Dビュー内の家具をクリックしてください。</div>}
    </div>
   </section>
  </main>
  <footer><span>ROOM/PLAN © 2026</span><span>寸法は一般的なサイズを参考にした概算です。実際の製品寸法とは異なる場合があります。</span><span>BUILT FOR YOUR SPACE</span></footer>
 </div>
}
createRoot(document.getElementById('root')).render(<App/>);