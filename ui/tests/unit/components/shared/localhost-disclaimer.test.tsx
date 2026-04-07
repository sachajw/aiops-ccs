import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocalhostDisclaimer } from '@/components/shared/localhost-disclaimer';

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: useAuthMock,
}));

describe('LocalhostDisclaimer', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it('shows the local safety copy for loopback sessions', () => {
    useAuthMock.mockReturnValue({
      authEnabled: false,
      isLocalAccess: true,
      loading: false,
    });

    render(<LocalhostDisclaimer />);

    expect(
      screen.getByText('This dashboard runs locally. All data stays on your machine.')
    ).toBeVisible();
  });

  it('shows the remote read-only copy when auth is disabled for remote access', () => {
    useAuthMock.mockReturnValue({
      authEnabled: false,
      isLocalAccess: false,
      loading: false,
    });

    render(<LocalhostDisclaimer />);

    expect(
      screen.getByText(
        'Remote dashboard access is read-only until you run ccs config auth setup on the host.'
      )
    ).toBeVisible();
  });
});
