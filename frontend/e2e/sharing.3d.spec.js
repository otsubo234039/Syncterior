import { test } from './fixtures/test.js';
import { verifySharedRoom } from './fixtures/shared-room-flow.js';

for (const profile of [
  { name: 'デスクトップ幅', viewport: { width: 1440, height: 1000 }, isMobile: false },
  { name: 'モバイル幅', viewport: { width: 390, height: 844 }, isMobile: true },
]) {
  test.describe(profile.name, () => {
    test.use({ viewport: profile.viewport, isMobile: profile.isMobile, hasTouch: profile.isMobile, sceneMode: 'full' });
    test('2つのブラウザから同じ部屋に参加し、家具・間取り・参加人数が同期される', verifySharedRoom);
  });
}
