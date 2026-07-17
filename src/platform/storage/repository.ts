import { browser } from 'wxt/browser';
import { type z } from 'zod';
import { createLogger } from '../logging';

/**
 * Versioned storage repository (SDD §6, §9).
 *
 * Every persisted document is wrapped in `{ version, data }`. On read, the
 * repository migrates forward step-by-step, validates with zod, and falls
 * back to defaults if the stored value is unreadable — the extension must
 * never brick itself over a bad write from an older version.
 */

const log = createLogger('storage');

/** Migrates a document from `fromVersion` to `fromVersion + 1`. */
export type Migration = (old: unknown) => unknown;

export interface RepositoryOptions<S extends z.ZodType> {
  /** storage key, also the migration unit */
  key: string;
  /** current schema version; bump when `schema` changes shape */
  version: number;
  schema: S;
  defaults: z.output<S>;
  /** keyed by the version being migrated FROM (1 → migrates v1 to v2) */
  migrations?: Readonly<Record<number, Migration>>;
  area?: 'local' | 'session';
}

export interface Repository<T> {
  readonly key: string;
  get(): Promise<T>;
  set(value: T): Promise<void>;
  update(fn: (current: T) => T): Promise<T>;
  clear(): Promise<void>;
}

interface Envelope {
  version: number;
  data: unknown;
}

function isEnvelope(value: unknown): value is Envelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Envelope).version === 'number' &&
    'data' in value
  );
}

export function defineRepository<S extends z.ZodType>(
  options: RepositoryOptions<S>,
): Repository<z.output<S>> {
  type T = z.output<S>;
  const { key, version, schema, defaults, migrations = {}, area = 'local' } = options;
  const storage = () => browser.storage[area];

  async function readMigrated(): Promise<T> {
    const raw = (await storage().get(key))[key];
    if (raw === undefined) {
      return defaults;
    }
    if (!isEnvelope(raw)) {
      log.warn(`${key}: stored value has no version envelope, resetting to defaults`);
      return defaults;
    }
    let { version: storedVersion, data } = raw;
    if (storedVersion > version) {
      // Downgrade (user installed an older build). Defaults are safer than
      // guessing at a future schema.
      log.warn(`${key}: stored version ${String(storedVersion)} is newer than ${String(version)}`);
      return defaults;
    }
    while (storedVersion < version) {
      const migrate = migrations[storedVersion];
      if (!migrate) {
        log.warn(`${key}: no migration from v${String(storedVersion)}, resetting to defaults`);
        return defaults;
      }
      data = migrate(data);
      storedVersion += 1;
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      log.warn(
        `${key}: stored value failed validation, resetting to defaults`,
        parsed.error.issues,
      );
      return defaults;
    }
    return parsed.data;
  }

  async function persist(value: T): Promise<void> {
    const envelope: Envelope = { version, data: schema.parse(value) };
    await storage().set({ [key]: envelope });
  }

  return {
    key,
    get: readMigrated,
    set: persist,
    async update(fn) {
      // MV3 workers are single-threaded per context; racing writers across
      // contexts are avoided by routing all writes through the background.
      const next = fn(await readMigrated());
      await persist(next);
      return next;
    },
    async clear() {
      await storage().remove(key);
    },
  };
}
