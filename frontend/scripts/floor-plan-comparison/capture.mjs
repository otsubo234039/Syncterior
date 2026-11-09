// 比較専用サーバー。製品への候補ライブラリの依存追加は行わない。
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, open, unlink } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { floorPlanFromLines } from '../../src/features/room-planner/utils/floor-plan-detection.js';
import { wallPieces } from '../../src/features/room-planner/utils/floor-plan.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(join(root,'package.json'));const {chromium}=require('@playwright/test');
const work=resolve(process.argv[2]??'/tmp/floor-plan-comparison');
const output=join(root,'docs/floor-plan-comparison-assets');await mkdir(output,{recursive:true});
const files={
 '/viewer.html':join(root,'scripts/floor-plan-comparison/viewer.html'),
 '/opencv-worker.js':join(root,'src/features/room-planner/utils/opencv-worker.js'),
 '/opencv.js':require.resolve('@techstark/opencv-js/dist/opencv.js'),
 '/blueprint.js':join(work,'blueprint.js'),
 '/legacy-three.js':join(work,'blueprint-runtime/node_modules/three/three.min.js'),
 '/jquery.js':join(work,'blueprint-runtime/node_modules/jquery/dist/jquery.js'),
};
// 通常E2Eと同じロックで、ソフトウェアWebGLと成果物の同時生成を避ける。
const lock=join(root,'.playwright-run.lock');
async function acquire(){
 for(let attempt=0;attempt<2;attempt++)try{const file=await open(lock,'wx');try{await file.writeFile(String(process.pid));}finally{await file.close();}return;}
 catch(error){if(error.code!=='EEXIST')throw error;const owner=Number(await readFile(lock,'utf8'));try{if(Number.isSafeInteger(owner)&&owner>0)process.kill(owner,0);else throw Error('invalid owner');}
 catch(check){if(check.code==='ESRCH'){await unlink(lock);continue;}}throw Error('E2Eまたは比較キャプチャが実行中です。終了してから再実行してください。');}
 throw Error('比較の実行ロックを取得できませんでした。');
}
await acquire();
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://localhost').pathname;
 let file=files[path];
 if(/^\/images\/[a-z-]+\.jpg$/.test(path))file=join(root,'e2e/fixtures/floor-plans',path.split('/').at(-1));
 if(/^\/three\/[a-z.]+\.js$/.test(path))file=join(root,'node_modules/three/build',path.split('/').at(-1));
 if(!file){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.jpg')?'image/jpeg':'text/javascript');res.end(await readFile(file));
 }catch(e){res.writeHead(500);res.end(String(e));}});
let browser;
try{
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const blueprintOnly=process.argv.includes('--blueprint-only');
const summaries=blueprintOnly?JSON.parse(await readFile(join(output,'run.json'),'utf8')).filter(r=>r.method!=='blueprint'):[];
 for(const image of (blueprintOnly?[]:['monochrome','colored','dark-background','textured'])){
  const context=await browser.newContext({viewport:{width:1000,height:1600},deviceScaleFactor:1});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/viewer.html');await page.waitForFunction(()=>window.ready);
  const start=performance.now();
  const raw=await page.evaluate(async image=>{const b=await createImageBitmap(await(await fetch(`/images/${image}.jpg`)).blob());const canvas=document.createElement('canvas');canvas.width=b.width;canvas.height=b.height;const ctx=canvas.getContext('2d');ctx.drawImage(b,0,0);const data=ctx.getImageData(0,0,b.width,b.height);return await new Promise((resolve,reject)=>{const worker=new Worker('/opencv-worker.js');const timer=setTimeout(()=>{worker.terminate();reject(Error('Worker timeout'));},60000);worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message));};worker.onmessage=({data})=>{clearTimeout(timer);worker.terminate();data.error?reject(Error(data.error)):resolve(data);};worker.postMessage({url:'/opencv.js',width:b.width,height:b.height,pixels:data.data.buffer},[data.data.buffer]);});},image);
  const plan=floorPlanFromLines(raw),convert=p=>[p[0]/plan.w*raw.width,p[1]/plan.d*raw.height];
  const polygons=plan.walls.flatMap(w=>wallPieces(w,plan).map(piece=>({outer:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>{const x=a*piece.size[0]/2,z=b*piece.size[2]/2;return convert([piece.position[0]+plan.w/2+x*Math.cos(piece.rotation)+z*Math.sin(piece.rotation),piece.position[2]+plan.d/2-x*Math.sin(piece.rotation)+z*Math.cos(piece.rotation)]);}),holes:[]})));
  const current={method:'current',image,width:raw.width,height:raw.height,polygons,floors:plan.floors.map(f=>({outer:f.points.map(convert),holes:[]})),elapsedMs:performance.now()-start,plan,errors:[]};
  await writeFile(join(work,'results',`current-${image}.json`),JSON.stringify(current));
  for(const method of ['current','blender','vectorizer-sealed','vectorizer-open']){
   const data=method==='current'?current:JSON.parse(await readFile(join(work,'results',`${method}-${image}.json`),'utf8'));
   await page.evaluate(data=>window.showResult(data),data);
   await page.locator('#overlay').screenshot({path:join(output,`${method}-${image}-recognition.png`)});
   await page.locator('#view').screenshot({path:join(output,`${method}-${image}-3d.png`)});
   await page.evaluate(()=>window.disposeResult());
   summaries.push({method,image,polygons:data.polygons.length,floors:data.floors.length,doors:data.doors?.length??null,windows:data.windows?.length??null,elapsedMs:data.elapsedMs,errors:data.errors});
  }
  if(errors.length)throw Error(errors.join('\n'));await context.close();console.log('captured',image);
 }
 if(blueprintOnly) for(const image of ['monochrome','colored','dark-background','textured']){
  const current=JSON.parse(await readFile(join(work,'results',`current-${image}.json`),'utf8'));
  const context=await browser.newContext({viewport:{width:1000,height:1600},deviceScaleFactor:1});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // 元の実装に同梱されたテクスチャを使用する。
  await page.route('**/rooms/textures/**',async route=>{const name=new URL(route.request().url()).pathname.split('/').at(-1);const allowed=/^[a-zA-Z0-9_.-]+$/.test(name);if(!allowed)return route.abort();try{await route.fulfill({body:await readFile(join(work,'blueprint3d-master/example/rooms/textures',name)),contentType:name.endsWith('.png')?'image/png':'image/jpeg'});}catch{await route.abort();}});
  await page.goto(origin+'/viewer.html');await page.waitForFunction(()=>window.ready);
  for(const src of ['/jquery.js','/legacy-three.js','/blueprint.js'])await page.addScriptTag({url:origin+src});
  const stats=await page.evaluate(async data=>{
   document.querySelector('#title').textContent=`${data.image} / Blueprint3D：現行OpenCVの認識結果を入力（独自認識なし）`;
   for(const id of ['overlay','view'])document.getElementById(id).style.display='none';
   for(const id of ['legacy2d','legacy3d'])document.getElementById(id).style.display='block';
   const model=new BP3D.Model.Model('');
   const main=new BP3D.Three.Main(model,'#legacy3d',null,{resize:false,spin:false});
   const editor=new BP3D.Floorplanner.Floorplanner('floorplanner-canvas',model.floorplan);
   const plan=data.plan,corners={},walls=[],unit=800/plan.w;
   const corner=p=>{const id=`p-${p.map(x=>Math.round(x*1e6)).join('-')}`;corners[id]={x:(p[0]-plan.w/2)*unit,y:(p[1]-plan.d/2)*unit};return id;};
   for(const wall of plan.walls)walls.push({corner1:corner(wall.start),corner2:corner(wall.end)});
   model.floorplan.loadFloorplan({corners,walls});
   model.floorplan.getWalls().forEach((w,i)=>{w.thickness=plan.wallThickness*(plan.walls[i].thicknessRatio??1)*unit;w.height=240;});model.floorplan.update();editor.reset();
   const size=Math.max(800,data.height/data.width*800,240),camera=main.getCamera();camera.fov=38;camera.updateProjectionMatrix();camera.position.set(size*.9,size*1.05,size*1.1);main.controls.target.set(0,60,0);main.controls.update();main.needsUpdate();
   // 実描画と画像テクスチャの完了を待つ。
   await new Promise((resolve,reject)=>{const start=performance.now();function ready(){if(performance.now()-start>30000)return reject(Error('legacy texture timeout'));if(THREE.ImageUtils.crossOrigin!==undefined && document.querySelector('#legacy3d canvas') && model.scene.getScene().children.length>1){requestAnimationFrame(()=>requestAnimationFrame(resolve));}else requestAnimationFrame(ready);}ready();});
   return {walls:model.floorplan.getWalls().length,rooms:model.floorplan.getRooms().length};
  },current);
  await page.locator('#legacy2d').screenshot({path:join(output,`blueprint-${image}-recognition.png`)});
  await page.locator('#legacy3d').screenshot({path:join(output,`blueprint-${image}-3d.png`)});
  if(errors.length)throw Error(errors.join('\n'));
  const result={method:'blueprint',image,...stats,recognitionSource:'current',errors};
  await writeFile(join(work,'results',`blueprint-${image}.json`),JSON.stringify(result));summaries.push(result);await context.close();console.log('Blueprint3D',image,stats);
 }
 await writeFile(join(output,'run.json'),JSON.stringify(summaries,null,2));
}finally{try{await browser?.close();if(server.listening)await new Promise(r=>server.close(r));}finally{if(await readFile(lock,'utf8')===String(process.pid))await unlink(lock);}}
