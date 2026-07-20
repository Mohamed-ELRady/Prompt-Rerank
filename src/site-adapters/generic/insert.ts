import {
  type CapturedTarget,
  type InsertMode,
  type InsertResult,
  type TextFieldTarget,
} from '../types';

/**
 * Generic insertion strategies (SDD §5.2, discovery challenge #1).
 *
 * Framework-controlled editors ignore naive `element.value = …` writes, so
 * both strategies route the change through the browser's own input-event
 * machinery: the native value setter + `input` event for form fields (what
 * React/Vue listen to), and `execCommand('insertText')` / synthetic
 * `beforeinput` for contenteditable (what ProseMirror/Lexical/Quill listen
 * to). Callers fall back to the clipboard when these report failure.
 */

function insertIntoTextField(
  target: TextFieldTarget,
  text: string,
  mode: InsertMode,
): InsertResult {
  const { element, start, end } = target;
  if (!element.isConnected) {
    return 'failed';
  }
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  // eslint-disable-next-line @typescript-eslint/unbound-method -- invoked via .call(element) below
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (!setter) {
    return 'failed';
  }
  const value = element.value;
  const [safeStart, safeEnd] =
    mode === 'replace-all'
      ? [0, value.length]
      : [Math.min(start, value.length), Math.min(Math.max(end, start), value.length)];
  element.focus();
  setter.call(element, value.slice(0, safeStart) + text + value.slice(safeEnd));
  element.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
  const caret = safeStart + text.length;
  element.setSelectionRange(caret, caret);
  return 'inserted';
}

function insertIntoContentEditable(
  root: HTMLElement,
  capturedRange: Range,
  text: string,
  mode: InsertMode,
): InsertResult {
  if (!root.isConnected) {
    return 'failed';
  }
  const selection = window.getSelection();
  if (!selection) {
    return 'failed';
  }
  // replace-all selects the whole editor's contents instead of the fragment.
  let range = capturedRange;
  if (mode === 'replace-all') {
    range = document.createRange();
    range.selectNodeContents(root);
  }
  root.focus();
  selection.removeAllRanges();
  try {
    selection.addRange(range);
  } catch {
    return 'failed';
  }

  // Primary path: execCommand routes through the editor framework's own
  // beforeinput/input handling and stays on the undo stack. Deprecated but
  // universally supported, and there is no full replacement yet.
  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    if (document.execCommand('insertText', false, text)) {
      return 'inserted';
    }
  } catch {
    // fall through to the manual path
  }

  // Fallback: announce via beforeinput (frameworks may handle + preventDefault),
  // otherwise mutate the range directly and announce with input.
  const beforeInput = new InputEvent('beforeinput', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertReplacementText',
    data: text,
  });
  const frameworkHandled = !root.dispatchEvent(beforeInput);
  if (frameworkHandled) {
    return 'inserted';
  }
  try {
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    selection.collapseToEnd();
    root.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
    return 'inserted';
  } catch {
    return 'failed';
  }
}

export function applyToTarget(
  target: CapturedTarget,
  text: string,
  mode: InsertMode = 'replace-selection',
): InsertResult {
  return target.kind === 'text-field'
    ? insertIntoTextField(target, text, mode)
    : insertIntoContentEditable(target.root, target.range, text, mode);
}
