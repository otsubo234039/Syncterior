import { test as base, expect } from '@playwright/test';

export async function installExternalAssets(context) {
  // PMREM needs a 16px cube face; keep the real WebGL path with a 64x32 RGBE image.
  const hdr = Buffer.concat([
    Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 32 +X 64\n'),
    Buffer.from(Array.from({ length: 64 * 32 }, () => [128, 128, 128, 129]).flat()),
  ]);
  await context.route(/\.hdr(?:\?|$)/, route => route.fulfill({ contentType: 'application/octet-stream', body: hdr }));
  await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
}

async function observeDrawCalls(context) {
  await context.addInitScript(() => {
    window.__e2eDrawCalls = 0;
    const seen = new WeakSet();
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const gl = getContext.apply(this, args);
      if (gl && /webgl/.test(args[0]) && !seen.has(gl)) {
        seen.add(gl);
        for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
          const original = gl[name].bind(gl);
          gl[name] = (...values) => { window.__e2eDrawCalls++; return original(...values); };
        }
      }
      return gl;
    };
  });
}

export const drawCalls = page => page.evaluate(() => window.__e2eDrawCalls);
export const waitForScene = page => expect.poll(() => drawCalls(page)).toBeGreaterThan(0);

export async function waitForSceneToSettle(page) {
  await waitForScene(page);
  // 最初の描画だけではカメラ・配置の反映が終わっていないことがある。
  await expect.poll(() => page.evaluate(async () => {
    const before = window.__e2eDrawCalls;
    for (let frame = 0; frame < 3; frame++) await new Promise(requestAnimationFrame);
    return before === window.__e2eDrawCalls;
  })).toBe(true);
}

async function prepareScene(context, mode) {
  // Both preview origins serve one build. Exercise the public runtime override.
  await context.addInitScript(() => {
    if (location.origin === 'http://127.0.0.1:4174') {
      globalThis.SYNCTERIOR_CONFIG = { roomApiUrl: '' };
    }
  });
  if (mode === 'full') await observeDrawCalls(context);
  let replaced = false;
  if (mode === 'ui') {
    await context.route(/\/assets\/planner-viewport-[^/]+\.js(?:\?.*)?$/, route => {
      replaced = true;
      return route.fulfill({ contentType: 'text/javascript', body: 'export default function TestViewport() { return null; }' });
    });
  }
  return async page => {
    if (mode === 'ui' && await page.getByRole('region', { name: '部屋の3Dプレビュー' }).count()) {
      expect(replaced, 'UI用のビューポート置換が適用されている').toBe(true);
      await expect(page.locator('canvas')).toHaveCount(0);
    } else if (mode === 'full' && await page.locator('canvas').count()) {
      await waitForScene(page);
    }
  };
}

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (/THREE.WebGLProgram: Shader Error|WebGL: INVALID_OPERATION/.test(message.text())) errors.push(message.text());
  });
  return errors;
}

export const test = base.extend({
  sceneMode: ['full', { option: true }],
  page: async ({ page, context, sceneMode }, use) => {
    await installExternalAssets(context);
    const verifyScene = await prepareScene(context, sceneMode);
    const errors = collectErrors(page);
    await use(page);
    await verifyScene(page);
    expect(errors, 'uncaught browser errors').toEqual([]);
  },
  guestPage: [async ({ browser, viewport, isMobile, baseURL, sceneMode }, use) => {
    const context = await browser.newContext({ viewport, isMobile, hasTouch: isMobile, baseURL });
    try {
      await installExternalAssets(context);
      const page = await context.newPage();
      const verifyScene = await prepareScene(context, sceneMode);
      const errors = collectErrors(page);
      await use(page);
      await verifyScene(page);
      expect(errors, 'uncaught guest browser errors').toEqual([]);
    } finally {
      await context.close();
    }
  }, { timeout: 120_000 }],
});
export { expect };
