import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('@/platform/messaging', () => ({
  sendMessage: vi.fn((type: string) =>
    Promise.resolve(
      type === 'history.list'
        ? { entries: [] }
        : {
            theme: 'light',
            defaultActionId: 'improve',
            disabledOrigins: [],
            historyExcludedOrigins: [],
            provider: { activeId: 'openai', configs: {} },
          },
    ),
  ),
}));

import { App } from './App';

describe('popup accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(<App />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
