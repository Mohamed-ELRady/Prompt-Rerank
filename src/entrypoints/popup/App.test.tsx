import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/messaging', () => ({
  sendMessage: vi.fn(() => Promise.resolve({ entries: [] })),
}));

import { App } from './App';

describe('popup App', () => {
  it('renders the quick-improve surface', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Prompt Rerank' })).toBeInTheDocument();
    expect(await screen.findByPlaceholderText('Paste a prompt to improve…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Improve' })).toBeDisabled();
  });
});
