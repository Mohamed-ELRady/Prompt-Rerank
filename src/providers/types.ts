/**
 * AI provider abstraction (SDD §5.1).
 *
 * Adapters normalize every vendor API to this contract so the rest of the
 * codebase never sees vendor payloads or vendor error shapes.
 */

export type ProviderErrorCode =
  | 'invalid_key'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'context_length'
  | 'model_not_found'
  | 'network'
  | 'unknown';

export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    message: string,
    /** true if an automatic retry with backoff is reasonable */
    readonly retryable: boolean = code === 'network' || code === 'rate_limited',
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface ProviderConfig {
  apiKey?: string;
  /** overrides the adapter's default endpoint (openai-compat, self-hosted) */
  baseUrl?: string;
  model: string;
}

export interface CompletionRequest {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

export interface CompletionResult {
  text: string;
}

export interface ModelInfo {
  id: string;
}

export interface ProviderMeta {
  label: string;
  requiresKey: boolean;
  defaultBaseUrl: string;
  defaultModel: string;
  /** shown under the key field in settings, e.g. a console URL */
  keyHint?: string;
}

export interface AIProvider {
  readonly id: string;
  readonly meta: ProviderMeta;
  listModels(config: ProviderConfig): Promise<ModelInfo[]>;
  /** Cheap end-to-end check of endpoint + key, for the settings UI. */
  validate(config: ProviderConfig): Promise<void>;
  complete(
    request: CompletionRequest,
    config: ProviderConfig,
    onChunk: (delta: string) => void,
    signal: AbortSignal,
  ): Promise<CompletionResult>;
}

/** Injectable fetch keeps adapters unit-testable without network (SDD §5.1). */
export type FetchLike = typeof globalThis.fetch;

export function toProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    // Aborts are control flow, not failures; callers filter on this message.
    return new ProviderError('unknown', 'aborted', false);
  }
  if (error instanceof TypeError) {
    return new ProviderError(
      'network',
      'Could not reach the provider. Check your connection and base URL.',
    );
  }
  return new ProviderError('unknown', error instanceof Error ? error.message : String(error));
}

/** Shared HTTP-status → ProviderError mapping for REST-ish vendors. */
export function errorFromStatus(status: number, body: string): ProviderError {
  const lower = body.toLowerCase();
  if (status === 401 || status === 403) {
    return new ProviderError('invalid_key', 'The API key was rejected by the provider.');
  }
  if (status === 404) {
    return new ProviderError('model_not_found', 'The requested model was not found.');
  }
  if (status === 429) {
    return lower.includes('quota') || lower.includes('billing')
      ? new ProviderError(
          'quota_exceeded',
          'The provider reports your quota or billing limit is exhausted.',
        )
      : new ProviderError(
          'rate_limited',
          'The provider is rate limiting requests. Try again shortly.',
        );
  }
  if (
    status === 400 &&
    (lower.includes('context') || lower.includes('too long') || lower.includes('maximum'))
  ) {
    return new ProviderError('context_length', 'The prompt is too long for this model.');
  }
  return new ProviderError(
    'unknown',
    `Provider returned HTTP ${String(status)}: ${body.slice(0, 200)}`,
  );
}
