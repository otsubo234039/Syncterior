import { chromium } from '@playwright/test';

try {
  const browser = await chromium.launch();
  await browser.close();
} catch (error) {
  console.error('E2E用のChromiumを起動できません。frontend/で次を実行してください。');
  console.error('  npm run test:e2e:install');
  console.error('インストールとテストでは、PLAYWRIGHT_BROWSERS_PATHを同じ設定にしてください。');
  console.error(error.message);
  process.exitCode = 1;
}
