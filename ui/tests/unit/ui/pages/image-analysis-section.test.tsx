import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent, waitFor } from '@tests/setup/test-utils';
import ImageAnalysisSection from '@/pages/settings/sections/image-analysis';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ImageAnalysisSection', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    let payload = {
      config: {
        enabled: true,
        timeout: 60,
        providerModels: {
          gemini: 'gemini-2.5-flash',
          ghcp: 'claude-haiku-4.5',
        },
        fallbackBackend: 'gemini',
        profileBackends: {
          codexProfile: 'ghcp',
        },
      },
      summary: {
        state: 'partial',
        title: 'Partially ready',
        detail:
          '1 backend still needs auth, runtime, or review before every profile path is healthy.',
        backendCount: 2,
        mappedProfileCount: 1,
        activeProfileCount: 1,
        bypassedProfileCount: 1,
      },
      backends: [
        {
          backendId: 'gemini',
          displayName: 'Google Gemini',
          model: 'gemini-2.5-flash',
          state: 'ready',
          authReadiness: 'ready',
          authReason: null,
          proxyReadiness: 'ready',
          proxyReason: null,
          profilesUsing: 1,
        },
        {
          backendId: 'ghcp',
          displayName: 'GitHub Copilot (OAuth)',
          model: 'claude-haiku-4.5',
          state: 'needs_auth',
          authReadiness: 'missing',
          authReason: 'Run ccs ghcp --auth',
          proxyReadiness: 'ready',
          proxyReason: null,
          profilesUsing: 1,
        },
      ],
      profiles: [
        {
          name: 'glm',
          kind: 'profile',
          target: 'claude',
          configured: true,
          settingsPath: '/tmp/glm.settings.json',
          backendId: 'gemini',
          backendDisplayName: 'Google Gemini',
          resolutionSource: 'cliproxy-bridge',
          status: 'active',
          effectiveRuntimeMode: 'cliproxy-image-analysis',
          effectiveRuntimeReason: null,
          currentTargetMode: 'active',
        },
        {
          name: 'codexProfile',
          kind: 'profile',
          target: 'codex',
          configured: true,
          settingsPath: '/tmp/codex.settings.json',
          backendId: 'ghcp',
          backendDisplayName: 'GitHub Copilot (OAuth)',
          resolutionSource: 'profile-backend',
          status: 'mapped',
          effectiveRuntimeMode: 'cliproxy-image-analysis',
          effectiveRuntimeReason: null,
          currentTargetMode: 'bypassed',
        },
      ],
      catalog: {
        knownBackends: ['gemini', 'ghcp', 'codex'],
        profileNames: ['glm', 'codexProfile'],
      },
    };

    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (url === '/api/image-analysis' && method === 'GET') {
        return jsonResponse(payload);
      }

      if (url === '/api/config/raw' && method === 'GET') {
        return new Response('image_analysis:\n  enabled: true\n');
      }

      if (url === '/api/image-analysis' && method === 'PUT') {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          timeout?: number;
          fallbackBackend?: string;
          profileBackends?: Record<string, string>;
          providerModels?: Record<string, string | null>;
        };

        payload = {
          ...payload,
          config: {
            enabled: true,
            timeout: body.timeout ?? payload.config.timeout,
            fallbackBackend: body.fallbackBackend ?? payload.config.fallbackBackend,
            providerModels: {
              gemini: String(body.providerModels?.gemini ?? payload.config.providerModels.gemini),
              ghcp: String(body.providerModels?.ghcp ?? payload.config.providerModels.ghcp),
            },
            profileBackends: body.profileBackends ?? payload.config.profileBackends,
          },
        };

        return jsonResponse(payload);
      }

      return jsonResponse({ error: `Unhandled request: ${method} ${url}` }, 500);
    });

    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders global controls and saves updated config', async () => {
    render(<ImageAnalysisSection />, { withSettingsProvider: true });

    expect(await screen.findByText('Image Analysis')).toBeInTheDocument();
    expect(screen.getByText('Partially ready')).toBeInTheDocument();
    expect(screen.getByText('Provider models')).toBeInTheDocument();
    expect(screen.getByText('Profile mappings')).toBeInTheDocument();
    expect(screen.getByText('Profile coverage')).toBeInTheDocument();
    expect(screen.getByText('Bypassed')).toBeInTheDocument();

    const timeoutInput = screen.getByDisplayValue('60');
    await userEvent.clear(timeoutInput);
    await userEvent.type(timeoutInput, '120');

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/image-analysis',
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === '/api/image-analysis' && (init as RequestInit | undefined)?.method === 'PUT'
    );
    expect(putCall).toBeDefined();

    const requestBody = JSON.parse(String((putCall?.[1] as RequestInit | undefined)?.body ?? '{}'));
    expect(requestBody).toMatchObject({
      timeout: 120,
      fallbackBackend: 'gemini',
      profileBackends: {
        codexProfile: 'ghcp',
      },
    });

    expect(await screen.findByText('Image Analysis settings saved.')).toBeInTheDocument();
  });

  it('surfaces a clear retryable error when the backend route is not available yet', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (url === '/api/image-analysis' && method === 'GET') {
        return new Response('<!doctype html><html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        });
      }

      if (url === '/api/config/raw' && method === 'GET') {
        return new Response('image_analysis:\n  enabled: true\n');
      }

      return jsonResponse({ error: `Unhandled request: ${method} ${url}` }, 500);
    });

    render(<ImageAnalysisSection />, { withSettingsProvider: true });

    expect(
      await screen.findByText(
        /Image Analysis settings returned an unexpected response\. Restart the dashboard server/i
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
