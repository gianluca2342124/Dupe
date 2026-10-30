import { useEffect, useId, useRef, useState } from 'react';

interface Props {
  /** Visual size: hero (home) or compact (results page). */
  size?: 'hero' | 'compact';
  autoFocus?: boolean;
  defaultValue?: string;
  placeholder?: string;
  submitLabel?: string;
}

/** Pulls the first URL out of pasted text (app share sheets add titles around it). */
export function findUrl(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const explicit = /https?:\/\/[^\s<>"'`]+/i.exec(t);
  const candidate = explicit
    ? explicit[0]
    : /^(?:www\d?\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/?][^\s]*)?$/i.test(t)
      ? `https://${t}`
      : null;
  if (!candidate) return null;
  try {
    const u = new URL(candidate.replace(/[),.;!?»”’]+$/u, ''));
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    return u.href;
  } catch {
    return null;
  }
}

export default function UrlForm({
  size = 'hero',
  autoFocus = false,
  defaultValue = '',
  placeholder = 'Pega el enlace del producto',
  submitLabel = 'Buscar alternativas',
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  // Detected after hydration so server and client render the same markup.
  const [canPaste, setCanPaste] = useState(false);
  useEffect(() => setCanPaste(!!navigator.clipboard?.readText), []);

  function go(raw: string) {
    const url = findUrl(raw);
    if (!url) {
      setError('Eso no parece un enlace. Copia la dirección completa de la página del producto.');
      inputRef.current?.focus();
      return;
    }
    setError(null);
    setBusy(true);
    // The prefix form doubles as a lesson: the address bar now shows the trick.
    window.location.assign(`/${url}`);
  }

  function onSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    go(value);
  }

  async function onPaste() {
    try {
      const text = await navigator.clipboard.readText();
      setValue(text);
      if (findUrl(text)) go(text);
    } catch {
      inputRef.current?.focus();
    }
  }

  const hero = size === 'hero';
  return (
    <form action="/buscar" method="get" onSubmit={onSubmit} noValidate className="w-full" role="search">
      <label htmlFor={id} className="sr-only">
        Enlace del producto
      </label>
      <div
        className={[
          'flex w-full items-center gap-2 rounded-full border bg-card transition-shadow focus-within:shadow-lift',
          error ? 'border-danger' : 'border-line-2',
          hero ? 'p-1.5 pl-5 shadow-card' : 'p-1 pl-4',
        ].join(' ')}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className={hero ? 'size-5 shrink-0 text-ink-3' : 'size-4 shrink-0 text-ink-3'} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" strokeLinecap="round" />
          <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          id={id}
          name="url"
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus={autoFocus}
          enterKeyHint="search"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={[
            'min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-3',
            hero ? 'h-12 text-base' : 'h-10 text-[15px]',
          ].join(' ')}
          data-testid="url-input"
        />
        {canPaste && !value && (
          <button type="button" onClick={onPaste} className="btn btn-ghost hidden !min-h-9 !px-3 text-sm sm:inline-flex" data-testid="paste-button">
            Pegar
          </button>
        )}
        <button type="submit" className={['btn btn-primary', hero ? '!min-h-12 !px-5' : '!min-h-10 !px-4 text-sm'].join(' ')} disabled={busy} data-testid="url-submit">
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-paper/40 border-t-paper" aria-hidden="true" />
              <span className="sr-only">Buscando…</span>
            </span>
          ) : (
            <>
              <span className={hero ? 'hidden sm:inline' : 'hidden sm:inline'}>{submitLabel}</span>
              <span className={hero ? 'sm:hidden' : 'sm:hidden'}>Buscar</span>
            </>
          )}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 pl-5 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
