import { openSync, readFileSync, writeFileSync, closeSync, unlinkSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';

const lock = fileURLToPath(new URL('../.playwright-run.lock', import.meta.url));
const require = createRequire(import.meta.url);

function acquire() {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const descriptor = openSync(lock, 'wx');
      writeFileSync(descriptor, String(process.pid));
      closeSync(descriptor);
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const owner = Number(readFileSync(lock, 'utf8'));
      if (Number.isSafeInteger(owner) && owner > 0) {
        try { process.kill(owner, 0); } catch (checkError) {
          if (checkError.code === 'ESRCH') { unlinkSync(lock); continue; }
        }
      }
      throw new Error('E2Eが実行中です。成果物の競合を防ぐため、終了してから再実行してください。');
    }
  }
  throw new Error('E2Eの実行ロックを取得できませんでした。');
}

async function runNode(args, environment = {}) {
  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    env: { ...process.env, ...environment, SYNCTERIOR_E2E_OWNER: String(process.pid) },
  });
  const interrupt = () => child.kill('SIGINT');
  const terminate = () => child.kill('SIGTERM');
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', terminate);
  try {
    return await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve(code ?? (signal === 'SIGINT' ? 130 : 1)));
    });
  } finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', terminate);
  }
}

try {
  acquire();
  try {
    const args = process.argv.slice(2);
    if (args[0] === '--evaluate-floor-plan') {
      process.exitCode = await runNode([fileURLToPath(new URL('./evaluate-floor-plan.js', import.meta.url))]);
    } else {
      const listing = args.some(arg => ['--list', '--help', '-h'].includes(arg));
      const started = performance.now();
      const vite = join(dirname(require.resolve('vite/package.json')), 'bin/vite.js');
      const buildCode = listing ? 0 : await runNode([vite, 'build', '--outDir', 'dist-e2e/app'], { VITE_ROOM_API_URL: '/api' });
      const built = performance.now();
      process.exitCode = buildCode || await runNode([require.resolve('@playwright/test/cli'), 'test', ...args]);
      if (!listing) {
        const completed = performance.now();
        const timing = { buildMs: built - started, playwrightMs: completed - built, totalMs: completed - started, exitCode: process.exitCode };
        const directory = new URL('../test-results/', import.meta.url);
        mkdirSync(directory, { recursive: true });
        writeFileSync(new URL('run-timing.json', directory), JSON.stringify(timing, null, 2));
        console.log(`E2E計測: ビルド ${(timing.buildMs / 1000).toFixed(1)}秒 / テスト ${(timing.playwrightMs / 1000).toFixed(1)}秒 / 合計 ${(timing.totalMs / 1000).toFixed(1)}秒`);
      }
    }
  } finally {
    if (readFileSync(lock, 'utf8') === String(process.pid)) unlinkSync(lock);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
