import * as path from 'path';
import { getCcsDir } from '../utils/config-manager';

export const OPENAI_COMPAT_PROXY_DEFAULT_PORT = 3456;
export const OPENAI_COMPAT_PROXY_SERVICE_NAME = 'ccs-openai-compat-proxy';

export function getOpenAICompatProxyDir(): string {
  return path.join(getCcsDir(), 'proxy');
}

export function getOpenAICompatProxyPidPath(): string {
  return path.join(getOpenAICompatProxyDir(), 'daemon.pid');
}

export function getOpenAICompatProxySessionPath(): string {
  return path.join(getOpenAICompatProxyDir(), 'session.json');
}
