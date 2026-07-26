import { spawn } from 'node:child_process';

function runProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    if (code && code !== 0) {
      process.exit(code);
    }
  });

  return child;
}

const isWindows = process.platform === 'win32';
const pnpmCommand = isWindows ? 'pnpm.cmd' : 'pnpm';

const web = runProcess(pnpmCommand, ['--filter', 'web', 'dev'], {
  env: process.env,
});

const proxy = runProcess('node', ['scripts/http-to-https-proxy.mjs'], {
  env: {
    ...process.env,
    NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED || '0',
  },
});

function shutdown(signal) {
  web.kill(signal);
  proxy.kill(signal);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
