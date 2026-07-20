import { describe, expect, it, vi } from 'vitest';
import { applyToTarget } from './insert';

describe('applyToTarget (text-field)', () => {
  function makeTextarea(value: string): HTMLTextAreaElement {
    const el = document.createElement('textarea');
    el.value = value;
    document.body.appendChild(el);
    return el;
  }

  it('replaces the captured range via the native setter and fires input', () => {
    const el = makeTextarea('improve THIS PART please');
    const onInput = vi.fn();
    el.addEventListener('input', onInput);

    const result = applyToTarget(
      { kind: 'text-field', element: el, start: 8, end: 17, text: 'THIS PART' },
      'that section',
    );

    expect(result).toBe('inserted');
    expect(el.value).toBe('improve that section please');
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(el.selectionStart).toBe('improve that section'.length);
  });

  it('clamps stale offsets instead of corrupting the value', () => {
    const el = makeTextarea('short');
    const result = applyToTarget(
      { kind: 'text-field', element: el, start: 2, end: 99, text: 'ort' },
      'X',
    );
    expect(result).toBe('inserted');
    expect(el.value).toBe('shX');
  });

  it('fails cleanly when the element left the DOM', () => {
    const el = document.createElement('textarea');
    el.value = 'gone';
    expect(
      applyToTarget({ kind: 'text-field', element: el, start: 0, end: 4, text: 'gone' }, 'x'),
    ).toBe('failed');
  });

  it('replace-all clears the whole field regardless of the captured range', () => {
    const el = makeTextarea('old prompt with extra tail text');
    const result = applyToTarget(
      // captured selection was only a fragment ("old prompt")
      { kind: 'text-field', element: el, start: 0, end: 10, text: 'old prompt' },
      'the brand new rewritten prompt',
      'replace-all',
    );
    expect(result).toBe('inserted');
    expect(el.value).toBe('the brand new rewritten prompt');
  });
});
