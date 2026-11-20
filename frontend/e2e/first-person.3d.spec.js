import { test, expect, drawCalls, waitForSceneToSettle } from './fixtures/test.js';
import { openLayout } from './fixtures/workspace.js';
for (const [name,width] of [['デスクトップ',1440],['モバイル幅',390]]) {
  test(`${name}で一人称のキー移動・見回し・停止と通常視点への復帰を実3Dで操作できる`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('syncterior.personal-room',JSON.stringify({version:1,room:{planKey:'studio',items:[]}})));
    await page.setViewportSize({width,height:900}); await openLayout(page);
    await page.getByRole('button',{name:/^デスク/}).click();
    // 正面の家具を目印にする。無地の壁だけでは横移動しても同じ画像になる。
    await page.getByLabel('左右位置 (X)').fill('0');
    await page.getByLabel('前後位置 (Z)').fill('-1.5');
    const saved = await page.evaluate(()=>localStorage.getItem('syncterior.personal-room'));
    const canvas=page.locator('canvas'); await canvas.scrollIntoViewIfNeeded(); await waitForSceneToSettle(page);
    await page.getByRole('button',{name:'一人称',exact:true}).click();
    await expect(canvas).toHaveAttribute('aria-label','一人称視点の操作');
    await expect(canvas).toBeFocused(); await waitForSceneToSettle(page);
    for (const code of ['KeyW','ArrowDown','KeyA','ArrowRight']) {
      await page.getByRole('button',{name:'3D',exact:true}).click();
      await page.getByRole('button',{name:'一人称',exact:true}).click();
      await waitForSceneToSettle(page);
      const before=await canvas.screenshot(), count=await drawCalls(page);
      await page.keyboard.down(code);
      try { await expect.poll(()=>drawCalls(page)).toBeGreaterThan(count+3); }
      finally { await page.keyboard.up(code); }
      await waitForSceneToSettle(page);
      expect(before.equals(await canvas.screenshot()),`${code}で視点位置が変わる`).toBe(false);
    }
    const box=await canvas.boundingBox(), before=await canvas.screenshot();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.down();
    await page.mouse.move(box.x+box.width/2+40,box.y+box.height/2+30,{steps:4}); await page.mouse.up();
    await waitForSceneToSettle(page); expect(before.equals(await canvas.screenshot())).toBe(false);
    await page.keyboard.down('KeyW');
    await page.getByLabel('左右位置 (X)').focus();
    await waitForSceneToSettle(page); await page.keyboard.up('KeyW');
    const stopped=await canvas.screenshot();
    await page.keyboard.press('ArrowRight');
    await waitForSceneToSettle(page);
    expect(stopped.equals(await canvas.screenshot()),'入力欄の矢印キーで視点が移動しない').toBe(true);
    await canvas.focus(); await page.keyboard.press('Escape');
    await expect(page.getByRole('button',{name:'3D',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(canvas).not.toHaveAttribute('aria-label','一人称視点の操作');
    await waitForSceneToSettle(page);
    expect(await page.evaluate(()=>localStorage.getItem('syncterior.personal-room'))).toBe(saved);
    await page.getByRole('button',{name:'一人称',exact:true}).click();
    await page.getByRole('button',{name:'平面図',exact:true}).click();
    await expect(canvas).toHaveCount(0);
    await page.getByRole('button',{name:'3D',exact:true}).click(); await waitForSceneToSettle(page);
    await expect(canvas).not.toHaveAttribute('aria-label','一人称視点の操作');
  });
}
