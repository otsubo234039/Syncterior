import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import http from 'node:http';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const landingDir = path.resolve(frontendDir, '..', 'landing');
const npmCli = process.env.npm_execpath;
const npmCommand = npmCli
  ? { command: process.execPath, argsPrefix: [npmCli] }
  : { command: process.platform === 'win32' ? 'npm.cmd' : 'npm', argsPrefix: [] };

function run(args, cwd) {
  return spawn(npmCommand.command, [...npmCommand.argsPrefix, ...args], {
    cwd,
    env: process.env,
    stdio: 'inherit',
  });
}

function portResponds(port) {
  return new Promise(resolve => {
    const request = http.get({ hostname: '127.0.0.1', port, path: '/', timeout: 500 }, response => {
      response.resume();
      resolve(true);
    });
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
    request.on('error', () => resolve(false));
  });
}

async function startServers() {
  const [landingRunning, frontendRunning] = await Promise.all([
    portResponds(5174),
    portResponds(5173),
  ]);
  const started = [];
  if (!landingRunning) {
    console.log('ランディングページを5174番で起動します。');
    started.push(run(['run', 'dev'], landingDir));
  } else {
    console.log('ランディングページは既に5174番で起動しています。');
  }
  if (!frontendRunning) {
    console.log('シミュレーターを5173番で起動します。');
    started.push(run(['run', 'dev:frontend'], frontendDir));
  } else {
    console.log('シミュレーターは既に5173番で起動しています。');
  }
  return started;
}

let stopping = false;
let processes = [];

function stopAll() {
  if (stopping) return;
  stopping = true;
  processes.forEach(child => {
    if (!child.killed) child.kill('SIGTERM');
  });
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(130);
});

process.on('SIGTERM', () => {
  stopAll();
  process.exit(143);
});

async function main() {
  processes = await startServers();
  processes.forEach(child => {
    child.on('error', error => {
      console.error(`開発サーバーの起動に失敗しました: ${error.message}`);
    });
    child.on('exit', (code, signal) => {
      if (stopping || (code === 0 && signal === null)) return;
      if (code !== null && code !== 0) {
        console.error(`開発サーバーが終了しました (code=${code})。`);
        stopAll();
        process.exitCode = code;
      }
    });
  });
}

void main();
