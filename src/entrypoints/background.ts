import { browser, defineBackground } from '#imports';
import { analyzePrompt, buildMetaPrompt, getAction, type TargetModel } from '@/core';
import { createLogger } from '@/platform/logging';
import { registerMessageHandlers } from '@/platform/messaging';
import { improvePort, type ImproveServerMessage } from '@/platform/messaging/improve-port';
import { onPortConnect, type PortSession } from '@/platform/messaging/port';
import {
  providerTestPort,
  type ProviderTestServerMessage,
} from '@/platform/messaging/provider-test-port';
import { addHistoryEntry, historyRepo, settingsRepo, templatesRepo } from '@/platform/storage';
import { starterTemplates } from '@/platform/storage/starter-templates';
import { exportData, importData } from '@/platform/storage/transfer';
import { deleteApiKey, getApiKey, getMaskedKeyPreview, setApiKey } from '@/platform/storage/vault';
import { getProvider, providerRegistry, toProviderError, type ProviderConfig } from '@/providers';

const log = createLogger('background');

/** Resolves adapter defaults + settings overrides + vault key. */
async function resolveProviderConfig(providerId?: string): Promise<{
  providerId: string;
  config: ProviderConfig;
}> {
  const settings = await settingsRepo.get();
  const id = providerId ?? settings.provider.activeId;
  const provider = getProvider(id);
  const overrides = settings.provider.configs[id] ?? {};
  return {
    providerId: id,
    config: {
      apiKey: await getApiKey(id),
      baseUrl: overrides.baseUrl,
      model: overrides.model ?? provider.meta.defaultModel,
    },
  };
}

type ImproveSession = PortSession<
  typeof improvePort.clientMessage,
  typeof improvePort.serverMessage
>;

async function runImprove(
  session: ImproveSession,
  request: { text: string; actionId: string; origin?: string; targetModel?: TargetModel },
): Promise<void> {
  const post = (message: ImproveServerMessage) => {
    session.post(message);
  };
  try {
    const { providerId, config } = await resolveProviderConfig();
    const provider = getProvider(providerId);
    // Analysis-guided rewriting (FR-C2): the LLM fixes identified weaknesses
    // instead of rewriting blindly.
    const analysis = analyzePrompt(request.text);
    const action = getAction(request.actionId);
    const meta = buildMetaPrompt({
      actionId: request.actionId,
      text: request.text,
      analysis,
      targetModel: request.targetModel,
    });
    // Slightly higher default than before so distinct actions diverge more;
    // per-action overrides (e.g. Better alternative) push it further.
    const temperature = action.temperature ?? 0.5;

    // Widened type: mutated inside the onChunk closure, which narrowing misses.
    let streamedAny = false as boolean;
    const attempt = () =>
      provider.complete(
        { system: meta.system, user: meta.user, temperature },
        config,
        (delta) => {
          streamedAny = true;
          post({ type: 'chunk', delta });
        },
        session.signal,
      );

    let result;
    try {
      result = await attempt();
    } catch (error) {
      const providerError = toProviderError(error);
      // One retry with backoff for transient failures, but never mid-stream —
      // the client would see duplicated output.
      if (!providerError.retryable || streamedAny || session.signal.aborted) {
        throw providerError;
      }
      log.info(`retrying after ${providerError.code}`);
      await new Promise((resolve) => setTimeout(resolve, 750));
      result = await attempt();
    }

    if (session.signal.aborted) {
      return;
    }
    post({ type: 'done', improved: result.text });

    const settings = await settingsRepo.get();
    if (request.origin === undefined || !settings.historyExcludedOrigins.includes(request.origin)) {
      await addHistoryEntry({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        origin: request.origin ?? 'unknown',
        actionId: request.actionId,
        original: request.text,
        improved: result.text,
        favorite: false,
      });
    }
  } catch (error) {
    if (session.signal.aborted) {
      return; // client went away; nobody to tell
    }
    const providerError = toProviderError(error);
    log.warn(`improve failed: ${providerError.code}`);
    post({ type: 'error', code: providerError.code, message: providerError.message });
  }
}

type ProviderTestSession = PortSession<
  typeof providerTestPort.clientMessage,
  typeof providerTestPort.serverMessage
>;

async function runProviderTest(
  session: ProviderTestSession,
  request: { providerId: string },
): Promise<void> {
  const post = (message: ProviderTestServerMessage) => {
    session.post(message);
  };
  try {
    const { config } = await resolveProviderConfig(request.providerId);
    const result = await getProvider(request.providerId).complete(
      {
        system: 'You are a connectivity test. Reply with only the single word "pong".',
        user: 'ping',
        temperature: 0,
        maxTokens: 10,
      },
      config,
      () => undefined,
      session.signal,
    );
    if (session.signal.aborted) {
      return;
    }
    post({ type: 'done', reply: result.text.trim() });
  } catch (error) {
    if (session.signal.aborted) {
      return; // client went away; nobody to tell
    }
    const providerError = toProviderError(error);
    post({ type: 'error', code: providerError.code, message: providerError.message });
  }
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener((details) => {
    log.info(`installed (${details.reason})`);
    // Reading + rewriting runs pending migrations once per update instead of
    // lazily on first use.
    void settingsRepo.get().then((settings) => settingsRepo.set(settings));
    // Seed the starter library exactly once and open onboarding (FR-F2).
    if (details.reason === 'install') {
      void templatesRepo.update(({ templates }) =>
        templates.length === 0 ? { templates: starterTemplates } : { templates },
      );
      void browser.tabs.create({ url: `${browser.runtime.getURL('/options.html')}#welcome` });
    }
  });

  browser.commands.onCommand.addListener((command) => {
    if (command !== 'improve-selection') {
      return;
    }
    void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id !== undefined) {
        void browser.tabs
          .sendMessage(tab.id, { kind: 'promptpolish', type: 'command.improve' })
          .catch(() => undefined); // no content script on this page (e.g. chrome://)
      }
    });
  });

  onPortConnect(improvePort, (session) => {
    session.onMessage((message) => {
      void runImprove(session, message);
    });
  });

  onPortConnect(providerTestPort, (session) => {
    session.onMessage((message) => {
      void runProviderTest(session, message);
    });
  });

  registerMessageHandlers({
    ping: () => Promise.resolve({ ok: true, version: browser.runtime.getManifest().version }),
    analyze: ({ text }) => Promise.resolve(analyzePrompt(text)),
    'settings.get': () => settingsRepo.get(),
    'settings.update': ({ patch }) => settingsRepo.update((current) => ({ ...current, ...patch })),
    'providers.list': async () => ({
      providers: await Promise.all(
        [...providerRegistry.values()].map(async (provider) => ({
          id: provider.id,
          ...provider.meta,
          keyPreview: await getMaskedKeyPreview(provider.id),
        })),
      ),
    }),
    'providers.models': async ({ providerId }) => {
      try {
        const { config } = await resolveProviderConfig(providerId);
        const models = await getProvider(providerId).listModels(config);
        return { ok: true, models: models.map((m) => m.id) };
      } catch (error) {
        const providerError = toProviderError(error);
        return { ok: false, code: providerError.code, message: providerError.message };
      }
    },
    'providers.validate': async ({ providerId }) => {
      try {
        const { config } = await resolveProviderConfig(providerId);
        await getProvider(providerId).validate(config);
        return { ok: true };
      } catch (error) {
        const providerError = toProviderError(error);
        return { ok: false, code: providerError.code, message: providerError.message };
      }
    },
    'vault.set': async ({ providerId, key }) => {
      await setApiKey(providerId, key);
      return { keyPreview: (await getMaskedKeyPreview(providerId)) ?? '••••' };
    },
    'vault.delete': async ({ providerId }) => {
      await deleteApiKey(providerId);
      return {};
    },
    'history.list': () => historyRepo.get(),
    'history.toggleFavorite': async ({ id }) => {
      await historyRepo.update(({ entries }) => ({
        entries: entries.map((e) => (e.id === id ? { ...e, favorite: !e.favorite } : e)),
      }));
      return {};
    },
    'history.delete': async ({ id }) => {
      await historyRepo.update(({ entries }) => ({
        entries: entries.filter((e) => e.id !== id),
      }));
      return {};
    },
    'history.clear': async () => {
      await historyRepo.set({ entries: [] });
      return {};
    },
    'templates.list': () => templatesRepo.get(),
    'templates.save': ({ template }) =>
      templatesRepo.update(({ templates }) => ({
        templates: [...templates.filter((t) => t.id !== template.id), template],
      })),
    'templates.delete': ({ id }) =>
      templatesRepo.update(({ templates }) => ({
        // starter templates are read-only (FR-F2)
        templates: templates.filter((t) => t.id !== id || !t.userOwned),
      })),
    'data.export': async () => ({ json: await exportData() }),
    'data.import': ({ json }) => importData(json),
  });
});
