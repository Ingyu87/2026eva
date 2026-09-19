import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const gitBash = `${process.env.ProgramFiles ?? 'C:/Program Files'}/Git/bin/bash.exe`;
const executable = process.platform === 'win32' && existsSync(gitBash) ? gitBash : 'bash';
const result = spawnSync(executable, process.argv.slice(2), { stdio: 'inherit', env: process.env });
if (result.error) console.error('Git Bash를 설치하거나 PATH에 bash를 추가하세요.');
process.exit(result.status ?? 1);
