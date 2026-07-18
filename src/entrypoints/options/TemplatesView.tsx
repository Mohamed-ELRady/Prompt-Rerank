import { useEffect, useState } from 'react';
import { sendMessage } from '@/platform/messaging';
import { type Template } from '@/platform/storage';
import { fillTemplate, templateVariables } from '@/platform/storage/starter-templates';

export function TemplatesView() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editing, setEditing] = useState<Template | null>(null);

  useEffect(() => {
    void sendMessage('templates.list', {}).then(({ templates: loaded }) => {
      setTemplates(loaded);
    });
  }, []);

  const save = async (template: Template) => {
    setTemplates((await sendMessage('templates.save', { template })).templates);
    setEditing(null);
  };

  const remove = async (id: string) => {
    setTemplates((await sendMessage('templates.delete', { id })).templates);
  };

  const startNew = () => {
    setEditing({
      id: crypto.randomUUID(),
      name: '',
      content: '',
      favorite: false,
      createdAt: Date.now(),
      userOwned: true,
    });
  };

  const sorted = [...templates].sort(
    (a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name),
  );

  return (
    <section aria-labelledby="templates-heading" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 id="templates-heading" className="text-lg font-medium">
          Templates
        </h2>
        <button
          type="button"
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
          onClick={startNew}
        >
          New template
        </button>
      </div>

      {editing && (
        <TemplateEditor
          template={editing}
          onSave={(t) => void save(t)}
          onCancel={() => {
            setEditing(null);
          }}
        />
      )}

      <ul className="space-y-3">
        {sorted.map((template) => (
          <TemplateRow
            key={template.id}
            template={template}
            onEdit={() => {
              setEditing(template);
            }}
            onDelete={() => void remove(template.id)}
            onToggleFavorite={() => void save({ ...template, favorite: !template.favorite })}
          />
        ))}
      </ul>
    </section>
  );
}

function TemplateRow({
  template,
  onEdit,
  onDelete,
  onToggleFavorite,
}: {
  template: Template;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  const variables = templateVariables(template.content);
  const [filling, setFilling] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const copy = () => {
    if (variables.length > 0 && !filling) {
      setFilling(true);
      return;
    }
    void navigator.clipboard.writeText(fillTemplate(template.content, values));
    setFilling(false);
  };

  return (
    <li className="rounded-lg border border-neutral-200 p-3 text-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="font-medium">
          {template.name || 'Untitled'}
          {!template.userOwned && (
            <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
              starter
            </span>
          )}
        </p>
        <span className="flex gap-2 text-xs">
          <button
            type="button"
            aria-label={template.favorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={template.favorite}
            className={template.favorite ? 'text-amber-500' : 'text-neutral-300'}
            onClick={onToggleFavorite}
          >
            ★
          </button>
          <button type="button" className="text-neutral-500 hover:text-neutral-800" onClick={copy}>
            {filling ? 'Copy filled' : 'Copy'}
          </button>
          {template.userOwned && (
            <>
              <button
                type="button"
                className="text-neutral-500 hover:text-neutral-800"
                onClick={onEdit}
              >
                Edit
              </button>
              <button
                type="button"
                className="text-neutral-400 hover:text-red-600"
                onClick={onDelete}
              >
                Delete
              </button>
            </>
          )}
        </span>
      </div>
      <p className="line-clamp-3 whitespace-pre-wrap text-neutral-500">{template.content}</p>
      {filling && variables.length > 0 && (
        <div className="mt-2 space-y-1.5 rounded-md bg-neutral-50 p-2">
          {variables.map((name) => (
            <label key={name} className="block text-xs">
              <span className="mb-0.5 block font-medium">{name}</span>
              <input
                type="text"
                className="w-full rounded border border-neutral-300 p-1.5"
                value={values[name] ?? ''}
                onChange={(e) => {
                  setValues({ ...values, [name]: e.target.value });
                }}
              />
            </label>
          ))}
        </div>
      )}
    </li>
  );
}

function TemplateEditor({
  template,
  onSave,
  onCancel,
}: {
  template: Template;
  onSave: (t: Template) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(template);
  return (
    <div className="space-y-2 rounded-lg border border-violet-300 p-3 text-sm">
      <label className="block">
        <span className="mb-1 block font-medium">Name</span>
        <input
          type="text"
          className="w-full rounded-md border border-neutral-300 p-2"
          value={draft.name}
          onChange={(e) => {
            setDraft({ ...draft, name: e.target.value });
          }}
        />
      </label>
      <label className="block">
        <span className="mb-1 block font-medium">
          Content <span className="font-normal text-neutral-400">(use {'{{variables}}'})</span>
        </span>
        <textarea
          rows={5}
          className="w-full rounded-md border border-neutral-300 p-2 font-mono text-xs"
          value={draft.content}
          onChange={(e) => {
            setDraft({ ...draft, content: e.target.value });
          }}
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-md bg-violet-600 px-3 py-1.5 text-white disabled:opacity-40"
          disabled={draft.name.trim() === '' || draft.content.trim() === ''}
          onClick={() => {
            onSave(draft);
          }}
        >
          Save
        </button>
        <button
          type="button"
          className="rounded-md border border-neutral-300 px-3 py-1.5"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
