import { fireEvent, render, screen, waitFor } from '@tests/setup/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageAnalysisStatus } from '@/lib/api-client';

vi.mock('@/components/shared/code-editor', () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea
      aria-label="raw config editor"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock('@/components/profiles/editor/header-section', () => ({
  HeaderSection: () => <div data-testid="profile-editor-header" />,
}));

vi.mock('@/components/profiles/editor/friendly-ui-section', () => ({
  FriendlyUISection: () => <div data-testid="profile-editor-friendly-ui" />,
}));

vi.mock('@/components/shared/confirm-dialog', () => ({
  ConfirmDialog: () => null,
}));

vi.mock('@/components/shared/global-env-indicator', () => ({
  GlobalEnvIndicator: () => <div data-testid="global-env-indicator" />,
}));

import { ImageAnalysisStatusSection } from '@/components/profiles/editor/image-analysis-status-section';
import { ProfileEditor } from '@/components/profiles/editor';

function createStatus(overrides: Partial<ImageAnalysisStatus> = {}): ImageAnalysisStatus {
  return {
    enabled: true,
    supported: true,
    status: 'active',
    backendId: 'gemini',
    backendDisplayName: 'Google Gemini',
    model: 'gemini-2.5-flash',
    resolutionSource: 'cliproxy-bridge',
    reason: null,
    shouldPersistHook: true,
    persistencePath: '/tmp/.ccs/glm.settings.json',
    runtimePath: '/api/provider/gemini',
    usesCurrentTarget: true,
    usesCurrentAuthToken: true,
    hookInstalled: true,
    sharedHookInstalled: true,
    authReadiness: 'ready',
    authProvider: 'gemini',
    authDisplayName: 'Google Gemini',
    authReason: null,
    proxyReadiness: 'ready',
    proxyReason: 'Local CLIProxy service is reachable.',
    effectiveRuntimeMode: 'cliproxy-image-analysis',
    effectiveRuntimeReason: null,
    ...overrides,
  };
}

function createJsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ImageAnalysisStatusSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders a compact saved summary with a settings link', () => {
    render(<ImageAnalysisStatusSection status={createStatus()} />);

    expect(screen.getByText('Image Analysis')).toBeInTheDocument();
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('CLIProxy active')).toBeInTheDocument();
    expect(
      screen.getByText(/Saved backend: Google Gemini\. Images and PDFs resolve through CLIProxy/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Backend')).toBeInTheDocument();
    expect(screen.getByText('Current target')).toBeInTheDocument();
    expect(screen.getByText('Persistence')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Settings/i })).toHaveAttribute(
      'href',
      '/settings?tab=imageanalysis'
    );
  });

  it('shows bypassed mode when the current target is not Claude Code', () => {
    render(<ImageAnalysisStatusSection status={createStatus()} target="codex" />);

    expect(screen.getByText('Bypassed')).toBeInTheDocument();
    expect(
      screen.getByText(/Current target Codex CLI bypasses the hook\. Saved Claude-side backend/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Codex CLI')).toBeInTheDocument();
    expect(
      screen.getByText(/Current launch path bypasses the Claude Read hook/i)
    ).toBeInTheDocument();
  });

  it('keeps auth failures visible without a long diagnostic wall', () => {
    render(
      <ImageAnalysisStatusSection
        status={createStatus({
          backendId: 'ghcp',
          backendDisplayName: 'GitHub Copilot (OAuth)',
          authReadiness: 'missing',
          authProvider: 'ghcp',
          authDisplayName: 'GitHub Copilot (OAuth)',
          authReason:
            'GitHub Copilot (OAuth) auth is missing. Run "ccs ghcp --auth" to enable image analysis.',
          effectiveRuntimeMode: 'native-read',
          effectiveRuntimeReason:
            'GitHub Copilot (OAuth) auth is missing. Run "ccs ghcp --auth" to enable image analysis.',
        })}
      />
    );

    expect(screen.getByText('Needs auth')).toBeInTheDocument();
    expect(
      screen.getByText(/Saved backend: GitHub Copilot \(OAuth\)\. Current runtime falls back/i)
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Run "ccs ghcp --auth" to enable image analysis/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it('switches to live preview when editor JSON changes', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/api/settings/glm/raw')) {
        return Promise.resolve(
          createJsonResponse({
            profile: 'glm',
            settings: {
              env: {
                ANTHROPIC_BASE_URL: 'https://api.z.ai/v1',
                ANTHROPIC_AUTH_TOKEN: 'saved-token',
              },
            },
            mtime: 1,
            path: '/tmp/glm.settings.json',
            imageAnalysisStatus: createStatus(),
          })
        );
      }

      if (url.includes('/api/settings/glm/image-analysis-status')) {
        expect(init?.method).toBe('POST');
        return Promise.resolve(
          createJsonResponse({
            imageAnalysisStatus: createStatus({
              backendId: 'ghcp',
              backendDisplayName: 'GitHub Copilot (OAuth)',
              model: 'claude-haiku-4.5',
              authReadiness: 'ready',
              authProvider: 'ghcp',
              authDisplayName: 'GitHub Copilot (OAuth)',
            }),
          })
        );
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<ProfileEditor profileName="glm" profileTarget="claude" />);

    expect(await screen.findByText('Google Gemini')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('raw config editor'), {
      target: {
        value: JSON.stringify(
          {
            env: {
              ANTHROPIC_BASE_URL: 'https://proxy.example/api/provider/ghcp',
              ANTHROPIC_AUTH_TOKEN: 'preview-token',
            },
          },
          null,
          2
        ),
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Live Preview')).toBeInTheDocument();
    });
    expect(screen.getByText('GitHub Copilot (OAuth)')).toBeInTheDocument();
    expect(screen.getByText(/Preview from the current editor JSON/i)).toBeInTheDocument();
  });

  it('falls back to saved status messaging when the editor JSON is invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes('/api/settings/glm/raw')) {
          return Promise.resolve(
            createJsonResponse({
              profile: 'glm',
              settings: {
                env: {
                  ANTHROPIC_BASE_URL: 'https://api.z.ai/v1',
                  ANTHROPIC_AUTH_TOKEN: 'saved-token',
                },
              },
              mtime: 1,
              path: '/tmp/glm.settings.json',
              imageAnalysisStatus: createStatus(),
            })
          );
        }

        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      })
    );

    render(<ProfileEditor profileName="glm" profileTarget="claude" />);

    expect(await screen.findByText('Google Gemini')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('raw config editor'), {
      target: { value: '{' },
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Showing saved status until the JSON above is valid again/i)
      ).toBeInTheDocument();
    });
  });

  it('marks the preview as refreshing when a newer preview is still loading', async () => {
    let secondPreviewResolver: ((value: Response) => void) | null = null;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/api/settings/glm/raw')) {
        return Promise.resolve(
          createJsonResponse({
            profile: 'glm',
            settings: {
              env: {
                ANTHROPIC_BASE_URL: 'https://api.z.ai/v1',
                ANTHROPIC_AUTH_TOKEN: 'saved-token',
              },
            },
            mtime: 1,
            path: '/tmp/glm.settings.json',
            imageAnalysisStatus: createStatus(),
          })
        );
      }

      if (url.includes('/api/settings/glm/image-analysis-status')) {
        expect(init?.method).toBe('POST');
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          settings?: { env?: Record<string, string> };
        };
        const baseUrl = body.settings?.env?.ANTHROPIC_BASE_URL ?? '';

        if (baseUrl.includes('/ghcp')) {
          return Promise.resolve(
            createJsonResponse({
              imageAnalysisStatus: createStatus({
                backendId: 'ghcp',
                backendDisplayName: 'GitHub Copilot (OAuth)',
                model: 'claude-haiku-4.5',
                authReadiness: 'ready',
                authProvider: 'ghcp',
                authDisplayName: 'GitHub Copilot (OAuth)',
              }),
            })
          );
        }

        if (baseUrl.includes('/codex')) {
          return new Promise<Response>((resolve) => {
            secondPreviewResolver = resolve;
          });
        }
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<ProfileEditor profileName="glm" profileTarget="claude" />);

    expect(await screen.findByText('Google Gemini')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('raw config editor'), {
      target: {
        value: JSON.stringify(
          {
            env: {
              ANTHROPIC_BASE_URL: 'https://proxy.example/api/provider/ghcp',
              ANTHROPIC_AUTH_TOKEN: 'preview-token',
            },
          },
          null,
          2
        ),
      },
    });

    expect(await screen.findByText('GitHub Copilot (OAuth)')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('raw config editor'), {
      target: {
        value: JSON.stringify(
          {
            env: {
              ANTHROPIC_BASE_URL: 'https://proxy.example/api/provider/codex',
              ANTHROPIC_AUTH_TOKEN: 'preview-token-2',
            },
          },
          null,
          2
        ),
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Refreshing')).toBeInTheDocument();
    });
    expect(screen.getByText(/Refreshing from the current editor state/i)).toBeInTheDocument();

    secondPreviewResolver?.(
      createJsonResponse({
        imageAnalysisStatus: createStatus({
          backendId: 'codex',
          backendDisplayName: 'Codex',
          model: 'gpt-5.4',
          authReadiness: 'ready',
          authProvider: 'codex',
          authDisplayName: 'Codex',
        }),
      })
    );

    await waitFor(() => {
      expect(screen.getByText('Codex')).toBeInTheDocument();
    });
  });
});
