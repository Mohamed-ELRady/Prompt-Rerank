import { useState } from 'react';
import { sendMessage } from '@/platform/messaging';

export function AdvancedView() {
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string }>();

  const doExport = async () => {
    const { json } = await sendMessage('data.export', {});
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'promptpolish-export.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (file: File) => {
    const result = await sendMessage('data.import', { json: await file.text() });
    setStatus(
      result.ok
        ? { kind: 'ok', text: 'Import complete. Settings and templates were applied.' }
        : { kind: 'error', text: result.message },
    );
  };

  return (
    <section aria-labelledby="advanced-heading" className="space-y-6">
      <h2 id="advanced-heading" className="text-lg font-medium">
        Advanced
      </h2>

      <div className="space-y-2 text-sm">
        <h3 className="font-medium">Backup &amp; transfer</h3>
        <p className="text-neutral-500">
          Exports settings and your own templates as JSON. API keys are never included.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-md border border-neutral-300 px-3 py-1.5"
            onClick={() => void doExport()}
          >
            Export
          </button>
          <label className="cursor-pointer rounded-md border border-neutral-300 px-3 py-1.5">
            Import…
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void doImport(file);
                }
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {status && (
          <p role="status" className={status.kind === 'error' ? 'text-red-600' : 'text-green-700'}>
            {status.text}
          </p>
        )}
      </div>
    </section>
  );
}
