import * as fs from 'fs';
import * as path from 'path';
import {
  getOpenAICompatProxyDir,
  getOpenAICompatProxyPidPath,
  getOpenAICompatProxySessionPath,
} from './proxy-daemon-paths';

export interface OpenAICompatProxySession {
  profileName: string;
  settingsPath: string;
  host: string;
  port: number;
  baseUrl: string;
  authToken: string;
  model?: string;
  insecure?: boolean;
}

function ensureProxyDir(): void {
  fs.mkdirSync(getOpenAICompatProxyDir(), { recursive: true });
}

export function getOpenAICompatProxyPid(): number | null {
  try {
    const raw = fs.readFileSync(getOpenAICompatProxyPidPath(), 'utf8').trim();
    const pid = Number.parseInt(raw, 10);
    return Number.isInteger(pid) ? pid : null;
  } catch {
    return null;
  }
}

export function writeOpenAICompatProxyPid(pid: number): void {
  ensureProxyDir();
  fs.writeFileSync(getOpenAICompatProxyPidPath(), String(pid), 'utf8');
}

export function removeOpenAICompatProxyPid(): void {
  try {
    fs.unlinkSync(getOpenAICompatProxyPidPath());
  } catch {
    // Best-effort cleanup.
  }
}

export function readOpenAICompatProxySession(): OpenAICompatProxySession | null {
  try {
    return JSON.parse(
      fs.readFileSync(getOpenAICompatProxySessionPath(), 'utf8')
    ) as OpenAICompatProxySession;
  } catch {
    return null;
  }
}

export function writeOpenAICompatProxySession(session: OpenAICompatProxySession): void {
  ensureProxyDir();
  fs.writeFileSync(
    getOpenAICompatProxySessionPath(),
    JSON.stringify(session, null, 2) + '\n',
    'utf8'
  );
}

export function removeOpenAICompatProxySession(): void {
  try {
    fs.unlinkSync(getOpenAICompatProxySessionPath());
  } catch {
    // Best-effort cleanup.
  }
}

export function resolveOpenAICompatProxyEntrypointCandidates(): string[] {
  const jsEntry = path.join(__dirname, 'proxy-daemon-entry.js');
  const tsEntry = path.join(__dirname, 'proxy-daemon-entry.ts');
  const isBunRuntime = process.execPath.toLowerCase().includes('bun');
  const runningFromDist = __filename.endsWith('.js');
  if (runningFromDist) {
    return [jsEntry];
  }
  return isBunRuntime ? [tsEntry, jsEntry] : [jsEntry];
}
