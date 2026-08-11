import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * @param {{ gitHead: string, gitStatus: string, now: Date }} input
 * @returns {{ buildDate: string, gitSha: string }}
 */
export function resolveBuildMetadata({ gitHead, gitStatus, now }) {
  const pad = (value) => String(value).padStart(2, '0');
  const buildDate = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join('') + `-${pad(now.getHours())}${pad(now.getMinutes())}`;

  return {
    buildDate,
    gitSha: `${gitHead.trim().slice(0, 8)}${gitStatus.trim() ? '(+)' : ''}`,
  };
}

function readBuildMetadata() {
  return resolveBuildMetadata({
    gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }),
    gitStatus: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }),
    now: new Date(),
  });
}

function run() {
  const [command, ...args] = process.argv.slice(2);
  if (!command) {
    console.error('Usage: run-with-build-metadata.mjs <command> [args...]');
    process.exitCode = 1;
    return;
  }

  const metadata = readBuildMetadata();
  const child = spawnSync(command, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      EXPO_PUBLIC_BUILD_DATE: metadata.buildDate,
      EXPO_PUBLIC_GIT_SHA: metadata.gitSha,
    },
  });

  if (child.error) {
    console.error(child.error.message);
    process.exitCode = 1;
    return;
  }

  process.exitCode = child.status ?? 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run();
}
