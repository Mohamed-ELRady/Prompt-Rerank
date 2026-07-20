/**
 * Selection capture and insertion contracts (SDD §5.2).
 *
 * A CapturedTarget freezes everything needed to later replace the selected
 * text, so the user can interact with the floating UI (which steals focus and
 * collapses the live selection) without losing the insertion point.
 */

export interface TextFieldTarget {
  kind: 'text-field';
  element: HTMLInputElement | HTMLTextAreaElement;
  start: number;
  end: number;
  text: string;
}

export interface ContentEditableTarget {
  kind: 'content-editable';
  root: HTMLElement;
  /** cloned so later selection changes don't move it */
  range: Range;
  text: string;
}

export type CapturedTarget = TextFieldTarget | ContentEditableTarget;

/**
 * 'replace-selection' swaps only the captured range; 'replace-all' clears the
 * whole field first — what Apply uses, since the user is rewriting the entire
 * prompt, not editing a fragment of it.
 */
export type InsertMode = 'replace-selection' | 'replace-all';

export type InsertResult = 'inserted' | 'failed';
