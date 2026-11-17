import { test, expect } from './fixtures/test.js';

test('削除対象の説明を表示せず、図面編集・3D表示・共有の操作を残す', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: '図面の編集', exact: true })).toBeVisible();
  await expect(page.getByText('未保存', { exact: true })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toContainText('家具寸法は目安です。実際の製品寸法をご確認ください。');
  const removed = [
    'FLOOR PLAN & INTERIOR', '編集モード', 'BUILT FOR YOUR SPACE', 'DRAW YOUR SPACE',
    '2D図面を作成・保存し、同じ図面から3Dを表示します。', '2D図面を編集',
    '下絵がありません。新しい画像は「間取り画像を図面へ変換」から読み込めます。',
    'OBJECT SETTINGS', '部屋のベースを選択してください',
    '家具はドラッグで移動、選択後に回転できます。寸法は一般的な製品の目安です。',
    '図面を作成・保存 → 3Dで確認・家具を配置', '接続が完了すると、最新の配置が表示されます。',
    'YOUR SPACE', '壁・床・開口の作成や画像の変換は「図面モード」で行います。', 'TIP',
    '壁・床・開口の変更は図面モードで編集してから3Dへ反映', '個人で編集中',
    'リンクを共有して、一緒に部屋づくり', 'CREATE TOGETHER',
    '図面を作成し、3Dを開かずに保存できます。',
    '2D図面から生成した間取り・壁や床の変更は図面モードで行えます',
  ];
  const absent = async () => {
    for (const text of removed) await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  };
  await absent();
  await page.getByRole('button', { name: '床1を選択', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByText(/^頂点\d+を編集$/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /に頂点を追加$/ })).toBeVisible();
  await page.getByRole('button', { name: '図面を保存', exact: true }).click();
  await page.getByRole('button', { name: '図面から3Dを表示', exact: true }).click();
  await expect(page.getByRole('region', { name: '部屋の3Dプレビュー' })).toBeVisible();
  await expect(page.getByRole('button', { name: '図面の編集へ', exact: true })).toBeVisible();
  await absent();
  await page.getByRole('button', { name: '部屋を共有', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: '部屋を共有' })).toBeVisible();
  await absent();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^ワンルーム/ }).click();
  await expect(page.getByRole('button', { name: '家具を選択してください' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'ワンルーム' })).toBeVisible();
  await absent();
});
