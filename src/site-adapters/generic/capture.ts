import { type CapturedTarget } from '../types';

function isTextField(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLTextAreaElement) {
    return true;
  }
  return el instanceof HTMLInputElement && ['text', 'search', 'url'].includes(el.type);
}

function editableRoot(node: Node | null): HTMLElement | null {
  let current: Node | null = node;
  while (current) {
    if (current instanceof HTMLElement && current.isContentEditable) {
      // walk up to the outermost editable element (the editor root)
      let root = current;
      while (root.parentElement?.isContentEditable) {
        root = root.parentElement;
      }
      return root;
    }
    current = current.parentNode;
  }
  return null;
}

/**
 * Captures the current selection if it lives in an editable surface.
 * Returns null for empty/whitespace selections or non-editable contexts.
 */
export function captureSelection(): CapturedTarget | null {
  const active = document.activeElement;
  if (isTextField(active)) {
    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? 0;
    const text = active.value.slice(start, end);
    if (text.trim() === '') {
      return null;
    }
    return { kind: 'text-field', element: active, start, end, text };
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  const range = selection.getRangeAt(0);
  const root = editableRoot(range.commonAncestorContainer);
  if (!root) {
    return null;
  }
  const text = selection.toString();
  if (text.trim() === '') {
    return null;
  }
  return { kind: 'content-editable', root, range: range.cloneRange(), text };
}

/** Viewport rectangle to anchor the floating UI to. */
export function targetAnchorRect(target: CapturedTarget): DOMRect {
  if (target.kind === 'content-editable') {
    const rect = target.range.getBoundingClientRect();
    // collapsed rect (e.g. after DOM churn) → fall back to the editor root
    return rect.width > 0 || rect.height > 0 ? rect : target.root.getBoundingClientRect();
  }
  return target.element.getBoundingClientRect();
}
