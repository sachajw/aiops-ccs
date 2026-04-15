import { detectShell, formatExportLine } from './env-command';
import { getSettingsPath, loadSettings } from '../utils/config-manager';
import { expandPath } from '../utils/helpers';
import { fail, info, ok } from '../utils/ui';
import {
  buildOpenAICompatProxyEnv,
  getOpenAICompatProxyStatus,
  resolveOpenAICompatProfileConfig,
  startOpenAICompatProxy,
  stopOpenAICompatProxy,
} from '../proxy';

function parseOptionValue(args: string[], key: string): string | undefined {
  const exactIndex = args.findIndex((arg) => arg === key);
  if (exactIndex !== -1 && args[exactIndex + 1]) {
    return args[exactIndex + 1];
  }

  const prefix = `${key}=`;
  const withEquals = args.find((arg) => arg.startsWith(prefix));
  return withEquals ? withEquals.slice(prefix.length) : undefined;
}

function showHelp(): number {
  console.log('OpenAI-Compatible Proxy');
  console.log('');
  console.log('Usage: ccs proxy <start|stop|status|activate> [profile] [options]');
  console.log('');
  console.log('Commands:');
  console.log(
    '  start <profile>   Start the local proxy for an OpenAI-compatible settings profile'
  );
  console.log('  stop              Stop the running proxy');
  console.log('  status            Show daemon status and active profile');
  console.log('  activate          Print shell exports for the running proxy');
  console.log('');
  console.log('Options:');
  console.log('  --port <n>        Override the local proxy port (default: 3456)');
  console.log('  --host <addr>     Bind the proxy server to a specific host (default: 127.0.0.1)');
  console.log('  --shell <name>    activate only: auto|bash|zsh|fish|powershell');
  console.log('  --fish            activate only: shorthand for --shell fish');
  console.log('  --insecure        Disable upstream TLS verification');
  console.log('');
  console.log('Examples:');
  console.log('  ccs proxy start hf');
  console.log('  eval "$(ccs proxy activate)"');
  console.log('  ccs proxy activate --fish');
  console.log('  ccs proxy status');
  console.log('  ccs proxy stop');
  console.log('');
  return 0;
}

function resolveProfile(profileName: string) {
  const settingsPath = expandPath(getSettingsPath(profileName));
  const settings = loadSettings(settingsPath);
  const profile = resolveOpenAICompatProfileConfig(profileName, settingsPath, settings.env || {});
  if (!profile) {
    throw new Error(`Profile "${profileName}" is not configured for an OpenAI-compatible endpoint`);
  }
  return profile;
}

async function handleStart(args: string[]): Promise<number> {
  const profileName = args.find((arg) => !arg.startsWith('-'));
  if (!profileName) {
    console.error(
      fail('Usage: ccs proxy start <profile> [--port <n>] [--host <addr>] [--insecure]')
    );
    return 1;
  }

  const portValue = parseOptionValue(args, '--port');
  const host = parseOptionValue(args, '--host');
  const port = portValue ? Number.parseInt(portValue, 10) || 3456 : undefined;
  let profile;
  try {
    profile = resolveProfile(profileName);
  } catch (error) {
    console.error(fail((error as Error).message));
    return 1;
  }

  const result = await startOpenAICompatProxy(profile, {
    ...(port ? { port } : {}),
    ...(host ? { host } : {}),
    insecure: args.includes('--insecure'),
  });

  if (!result.success) {
    console.error(fail(result.error || 'Failed to start proxy'));
    return 1;
  }

  console.log(
    result.alreadyRunning
      ? info(`Proxy already running on port ${result.port}`)
      : ok(`Proxy started on port ${result.port}`)
  );
  return 0;
}

async function handleStatus(): Promise<number> {
  const status = await getOpenAICompatProxyStatus();
  if (!status.running) {
    console.log(info('Proxy is not running'));
    return 0;
  }

  console.log(ok(`Proxy running on port ${status.port}`));
  if (status.host) {
    console.log(`  Host: ${status.host}`);
    console.log(`  Local URL: http://${status.host}:${status.port}`);
  }
  console.log(`  Profile: ${status.profileName}`);
  console.log(`  Base URL: ${status.baseUrl}`);
  if (status.model) {
    console.log(`  Model: ${status.model}`);
  }
  if (status.pid) {
    console.log(`  PID: ${status.pid}`);
  }
  return 0;
}

async function handleActivate(args: string[]): Promise<number> {
  const status = await getOpenAICompatProxyStatus();
  if (!status.running || !status.profileName || !status.port || !status.authToken) {
    console.error(fail('Proxy is not running. Start it with: ccs proxy start <profile>'));
    return 1;
  }

  const shell = detectShell(args.includes('--fish') ? 'fish' : parseOptionValue(args, '--shell'));
  let profile;
  try {
    profile = resolveProfile(status.profileName);
  } catch (error) {
    console.error(fail((error as Error).message));
    return 1;
  }

  const env = buildOpenAICompatProxyEnv(
    profile,
    status.port,
    status.authToken,
    undefined,
    status.host || '127.0.0.1'
  );
  Object.entries(env).forEach(([key, value]) => {
    console.log(formatExportLine(shell, key, value));
  });
  return 0;
}

export async function handleProxyCommand(args: string[]): Promise<number> {
  const subcommand = args[0];
  switch (subcommand) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      return showHelp();
    case 'start':
      return handleStart(args.slice(1));
    case 'stop': {
      const result = await stopOpenAICompatProxy();
      if (!result.success) {
        console.error(fail(result.error || 'Failed to stop proxy'));
        return 1;
      }
      console.log(ok('Proxy stopped'));
      return 0;
    }
    case 'status':
      return handleStatus();
    case 'activate':
      return handleActivate(args.slice(1));
    default:
      console.error(fail(`Unknown proxy subcommand: ${subcommand}`));
      return 1;
  }
}
