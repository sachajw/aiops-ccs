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

  it('renders saved diagnostics for an active backend', () => {
    render(<ImageAnalysisStatusSection status={createStatus()} />);

    expect(screen.getByText('Image-analysis backend')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Saved runtime status for this profile\. This section is derived and is not written into the JSON editor above\./i
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Configured')).toBeInTheDocument();
    expect(screen.getByText(/Configured via Google Gemini\./i)).toBeInTheDocument();
    expect(screen.getByText('Google Gemini')).toBeInTheDocument();
    expect(screen.getByTitle(/\/api\/provider\/gemini/)).toBeInTheDocument();
    expect(screen.getByText('gemini-2.5-flash')).toBeInTheDocument();
  });

  it('renders mapped status and the explicit mapping explanation', () => {
    render(
      <ImageAnalysisStatusSection
        status={createStatus({
          status: 'mapped',
          backendId: 'ghcp',
          backendDisplayName: 'GitHub Copilot (OAuth)',
          model: 'claude-haiku-4.5',
          resolutionSource: 'profile-backend',
          reason: 'Using explicit profile mapping.',
        })}
      />
    );

    expect(screen.getByText('Saved mapping')).toBeInTheDocument();
    expect(
      screen.getByText(/Configured via saved GitHub Copilot \(OAuth\) mapping/i)
    ).toBeInTheDocument();
    expect(screen.getByText('GitHub Copilot (OAuth)')).toBeInTheDocument();
    expect(screen.getByText('claude-haiku-4.5')).toBeInTheDocument();
  });

  it('renders hook-missing state as native file access until the hook is installed', () => {
    render(
      <ImageAnalysisStatusSection
        status={createStatus({
          status: 'hook-missing',
          reason: 'Profile hook is missing from the persisted settings file.',
        })}
      />
    );

    expect(screen.getByText('Setup needed')).toBeInTheDocument();
    expect(
      screen.getByText(/Configured for Google Gemini, but Profile hook is missing/i)
    ).toBeInTheDocument();
    expect(screen.getByTitle(/native file access \(hook install required\)/i)).toBeInTheDocument();
  });

  it('uses the resolver reason for attention states like auth-token drift', () => {
    render(
      <ImageAnalysisStatusSection
        status={createStatus({
          status: 'attention',
          reason:
            'Runtime uses the current CLIProxy auth token instead of the saved token in this profile.',
          usesCurrentTarget: true,
          usesCurrentAuthToken: false,
        })}
      />
    );

    expect(screen.getByText('Needs review')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Configured via Google Gemini, but Runtime uses the current CLIProxy auth token/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/current CLIProxy auth token instead of the saved token/i)
    ).toHaveLength(2);
  });

  it('switches the panel to a live preview when the current editor JSON changes', async () => {
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
              runtimePath: '/api/provider/ghcp',
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
      expect(screen.getByText('GitHub Copilot (OAuth)')).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        /Live preview from the current editor state\. Save to persist these backend and hook changes\./i
      )
    ).toBeInTheDocument();
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
        screen.getByText(
          /Showing last saved runtime status\. The live preview resumes when the JSON above is valid again\./i
        )
      ).toBeInTheDocument();
    });
    expect(screen.getByText('Google Gemini')).toBeInTheDocument();
  });
});
