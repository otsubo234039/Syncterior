import { test, expect } from './fixtures/test.js';
import { openLayout } from './fixtures/workspace.js';
test('一人称と平面図・通常3Dを切り替えても配置の保存を変更しない',async({page})=>{
  await openLayout(page);
  const saved=await page.evaluate(()=>localStorage.getItem('syncterior.personal-room'));
  await page.getByRole('button',{name:'一人称',exact:true}).click();
  await expect(page.getByRole('button',{name:'一人称',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByText('画面を選択 → WASD／矢印で移動・ドラッグで見回す・Escで終了')).toBeVisible();
  await page.getByRole('button',{name:'平面図',exact:true}).click();
  await expect(page.getByRole('region',{name:'部屋の平面プレビュー'})).toBeVisible();
  await page.getByRole('button',{name:'一人称',exact:true}).click();
  await page.getByRole('button',{name:'3D',exact:true}).click();
  await expect(page.getByRole('button',{name:'3D',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>localStorage.getItem('syncterior.personal-room'))).toBe(saved);
});
