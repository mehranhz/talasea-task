import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Loads apps/api/.env for host dev when a variable is not already set.
 * The path is next to this package, so it works whether the process is started from the repo root or from apps/api.
 * Docker Compose and the test harness inject the environment themselves, so an existing value wins.
 */
export function loadDotEnv(filePath = resolve(__dirname, '../../.env')): void {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
    const normalized = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed;
    const eq = normalized.indexOf('=');
    if (eq <= 0) continue;
    const key = normalized.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = normalized.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2);
    if (quoted) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
