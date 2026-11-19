import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import Dropdown from './Dropdown.jsx';
import { TYPES, STANDARD, getType, standardFields, instanceRows, applyType, searchText } from './types.js';
import { shareText, hasSecrets, slug } from './share.js';

const AUTO_HIDE_SECONDS = 30;
const ENVIRONMENTS = ['Production', 'UAT', 'Staging', 'QA', 'Development', 'Testing', 'Other'];

const APP_FORM = [
  { key: 'name', label: 'Application name', required: true, placeholder: 'e.g. Molta AI' },
  { key: 'owner', label: 'Owner / Contact', placeholder: 'e.g. Platform team' },
  { key: 'description', label: 'Description', type: 'textarea', placeholder: 'What is this application for?' },
  { key: 'tags', label: 'Tags', placeholder: 'Comma separated, e.g. client, web', full: true },
];

const ENV_OPTIONS = [
  { value: '', label: 'None' },
  ...ENVIRONMENTS.map((e) => ({ value: e, label: e, dot: 'env-' + e.toLowerCase() })),
];
const TYPE_OPTIONS = TYPES.map((t) => ({ value: t.label, label: t.label, icon: t.icon }));

// The instance form changes with the chosen type
const instForm = (values) => [
  { key: 'name', label: 'Instance name', required: true, placeholder: 'e.g. Production bucket', full: true },
  { key: 'type', label: 'Type', type: 'select', options: TYPE_OPTIONS },
  { key: 'environment', label: 'Environment', type: 'select', options: ENV_OPTIONS },
  { section: 'Details' },
  ...standardFields(values).filter((f) => f.key !== 'notes'),
  { custom: true },
  { section: 'Other' },
  { key: 'notes', ...STANDARD.notes },
];

const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(16).slice(2)).replace(/-/g, '').slice(0, 8);

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';

// Stable accent colour per application name
const hue = (name) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

const href = (url) => (/^[a-z][a-z\d+.-]*:/i.test(url) ? url : 'https://' + url);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// index.html sets <html data-theme> before first paint (saved choice, else the OS setting)
function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {}
    setTheme(next);
  };
  return [theme, toggle];
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export default function App() {
  const [apps, setApps] = useState([]);
  const [file, setFile] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [envFilter, setEnvFilter] = useState('');
  const [modal, setModal] = useState(null); // {kind, appId, instId}
  const [confirm, setConfirm] = useState(null);
  const [share, setShare] = useState(null); // {appId, instId?}
  const [toast, setToast] = useState(null);
  const [revealed, setRevealed] = useState({}); // "instId:key" -> true
  const [copied, setCopied] = useState(null);
  const [flash, setFlash] = useState(null); // id of the card/instance just added or edited
  const [expanded, setExpanded] = useState({}); // instId -> true/false; unset uses the default
  const [theme, toggleTheme] = useTheme();
  const timers = useRef({});
  const searchRef = useRef(null);

  const showToast = (msg, error = false) => {
    setToast({ msg, error });
    clearTimeout(timers.current.toast);
    timers.current.toast = setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    fetch('/api/apps')
      .then((r) => r.json())
      .then((d) => {
        setApps(d.apps || []);
        setFile(d.file || '');
      })
      .catch(() => showToast('Could not load data. Is the server running?', true))
      .finally(() => setLoading(false));
  }, []);

  // Hide everything when you switch tab / minimise the window
  useEffect(() => {
    const onHide = () => document.hidden && hideAll();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  // Ctrl/⌘ + K focuses search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Bring the item just added/edited into view and highlight it briefly
  useEffect(() => {
    if (!flash) return;
    document.getElementById('item-' + flash)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const t = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  // Shows the change at once, then rolls back if writing apps.md fails
  const save = async (next, msg) => {
    const prev = apps;
    setApps(next);
    try {
      const r = await fetch('/api/apps', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apps: next }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Save failed');
      setApps(d.apps);
      showToast(msg || 'Saved');
    } catch (e) {
      setApps(prev);
      showToast('Save failed: ' + e.message, true);
    }
  };

  const hideAll = () => {
    Object.entries(timers.current).forEach(([k, t]) => k !== 'toast' && clearTimeout(t));
    timers.current = { toast: timers.current.toast };
    setRevealed({});
  };

  const toggleReveal = (id) => {
    setRevealed((r) => {
      const next = { ...r };
      clearTimeout(timers.current[id]);
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = true;
        timers.current[id] = setTimeout(() => {
          setRevealed((cur) => {
            const c = { ...cur };
            delete c[id];
            return c;
          });
        }, AUTO_HIDE_SECONDS * 1000);
      }
      return next;
    });
  };

  const copy = async (text, id, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      clearTimeout(timers.current.copied);
      timers.current.copied = setTimeout(() => setCopied(null), 1500);
      showToast(`${label} copied to clipboard`);
    } catch {
      showToast('Copy failed', true);
    }
  };

  // ---------- add / edit / delete ----------
  // Application names must be unique (ignoring case and surrounding spaces)
  const validateModal = (values) => {
    if (modal.kind !== 'app') return null;
    const name = values.name.trim().toLowerCase();
    const clash = apps.find((a) => a.id !== modal.appId && a.name.trim().toLowerCase() === name);
    return clash ? `An application named “${clash.name}” already exists.` : null;
  };

  const submitModal = (values) => {
    const { kind, appId, instId } = modal;
    const editing = kind === 'app' ? appId : instId;
    const id = editing || newId();
    let next;
    if (kind === 'app') {
      if (appId) next = apps.map((a) => (a.id === appId ? { ...a, ...values } : a));
      else next = [...apps, { id, instances: [], ...values }];
    } else {
      next = apps.map((a) => {
        if (a.id !== appId) return a;
        const instances = instId
          ? a.instances.map((i) => (i.id === instId ? { ...i, ...values } : i))
          : [...a.instances, { id, ...values }];
        return { ...a, instances };
      });
    }
    setModal(null);
    // Clear filters so the new item can't be hidden by an old search
    if (!editing) {
      setSearch('');
      setEnvFilter('');
    }
    setFlash(id);
    if (kind !== 'app') setExpanded((e) => ({ ...e, [id]: true }));
    save(next, editing ? 'Changes saved' : `${kind === 'app' ? 'Application' : 'Instance'} added`);
  };

  const askDelete = (appId, instId) => {
    const app = apps.find((a) => a.id === appId);
    const inst = instId && app.instances.find((i) => i.id === instId);
    setConfirm({
      title: inst ? 'Delete instance' : 'Delete application',
      // Deleting a whole application needs its name typed in first
      confirmText: inst ? null : app.name,
      text: inst ? (
        <>
          <strong>{inst.name}</strong> will be permanently removed from <strong>{app.name}</strong>.
        </>
      ) : (
        <>
          <strong>{app.name}</strong> and its {plural(app.instances.length, 'instance')} will be permanently
          removed.
        </>
      ),
      run: () => {
        const next = inst
          ? apps.map((a) => (a.id === appId ? { ...a, instances: a.instances.filter((i) => i.id !== instId) } : a))
          : apps.filter((a) => a.id !== appId);
        setConfirm(null);
        save(next, inst ? 'Instance deleted' : 'Application deleted');
      },
    });
  };

  // ---------- search + environment filter (never searches inside secrets) ----------
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const has = (o, keys) => keys.some((k) => String(o[k] || '').toLowerCase().includes(q));
    return apps
      .map((a) => {
        const envInstances = envFilter ? a.instances.filter((i) => i.environment === envFilter) : a.instances;
        if (!q) return { ...a, instances: envInstances };
        const appMatch = has(a, ['name', 'description', 'owner', 'tags']);
        const instances = appMatch
          ? envInstances
          : envInstances.filter((i) => searchText(i).includes(q));
        return appMatch || instances.length ? { ...a, instances } : null;
      })
      .filter((a) => a && (!envFilter || a.instances.length));
  }, [apps, search, envFilter]);

  const totalInstances = apps.reduce((n, a) => n + a.instances.length, 0);
  const envCounts = useMemo(() => {
    const c = {};
    for (const a of apps) for (const i of a.instances) if (i.environment) c[i.environment] = (c[i.environment] || 0) + 1;
    return c;
  }, [apps]);
  const anyRevealed = Object.keys(revealed).length > 0;
  const fileName = file.split(/[\\/]/).pop();

  const modalApp = modal && apps.find((a) => a.id === modal.appId);
  const modalInitial =
    modal?.kind === 'app'
      ? modalApp || {}
      : modal?.instId
      ? modalApp.instances.find((i) => i.id === modal.instId)
      : applyType({ environment: 'Production', fields: [] }, 'Server');

  return (
    <div className="shell">
      <header className="appbar">
        <div className="appbar-inner">
          <div className="brand">
            <span className="brand-mark">
              <Icon name="shield" size={18} />
            </span>
            <span className="brand-name">App Vault</span>
          </div>

          <div className="searchbox">
            <Icon name="search" className="searchbox-icon" />
            <input
              ref={searchRef}
              placeholder="Search applications, instances, URLs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setSearch('')}
              aria-label="Search"
            />
            {search ? (
              <button className="searchbox-clear" onClick={() => setSearch('')} aria-label="Clear search">
                <Icon name="x" size={14} />
              </button>
            ) : (
              <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
            )}
          </div>

          <div className="appbar-actions">
            <button
              className="icon-btn theme-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="theme-icon" key={theme}>
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
              </span>
            </button>
            {anyRevealed && (
              <button className="btn btn-secondary" onClick={hideAll}>
                <Icon name="eyeOff" /> Hide all
              </button>
            )}
            <button className="btn btn-primary" onClick={() => setModal({ kind: 'app' })}>
              <Icon name="plus" /> New application
            </button>
          </div>
        </div>
      </header>

      <div className="content">
        <div className="page-head">
          <div>
            <h1>Applications</h1>
            <p className="page-sub">
              {plural(apps.length, 'application')} · {plural(totalInstances, 'instance')}
            </p>
          </div>
          {totalInstances > 0 && (
            <div className="segmented" role="tablist" aria-label="Filter by environment">
              <button className={!envFilter ? 'active' : ''} onClick={() => setEnvFilter('')}>
                All <span className="count">{totalInstances}</span>
              </button>
              {ENVIRONMENTS.filter((e) => envCounts[e]).map((e) => (
                <button key={e} className={envFilter === e ? 'active' : ''} onClick={() => setEnvFilter(e)}>
                  <span className={'dot env-' + e.toLowerCase()} />
                  {e} <span className="count">{envCounts[e]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid">
            {[0, 1].map((n) => (
              <div className="card skeleton" key={n}>
                <div className="sk sk-title" />
                <div className="sk sk-line" />
                <div className="sk sk-block" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <Icon name={apps.length ? 'search' : 'server'} size={26} />
            </div>
            {apps.length === 0 ? (
              <>
                <h2>No applications yet</h2>
                <p>Add your first application to start keeping its servers, URLs and logins in one place.</p>
                <button className="btn btn-primary" onClick={() => setModal({ kind: 'app' })}>
                  <Icon name="plus" /> New application
                </button>
              </>
            ) : (
              <>
                <h2>No results</h2>
                <p>
                  Nothing matches{search && <> “{search}”</>}
                  {envFilter && <> in {envFilter}</>}.
                </p>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setSearch('');
                    setEnvFilter('');
                  }}
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <main className="grid">
            {filtered.map((app) => (
              <section className={'card' + (flash === app.id ? ' flash' : '')} id={'item-' + app.id} key={app.id}>
                <div className="card-head">
                  <div className="avatar" style={{ '--h': hue(app.name) }}>
                    {initials(app.name)}
                  </div>
                  <div className="card-title">
                    <h2>{app.name}</h2>
                    {app.description && <p className="desc">{app.description}</p>}
                    {(app.owner || app.tags) && (
                      <div className="meta">
                        {app.owner && (
                          <span className="owner">
                            <Icon name="user" size={13} /> {app.owner}
                          </span>
                        )}
                        {app.tags &&
                          app.tags
                            .split(',')
                            .map((t) => t.trim())
                            .filter(Boolean)
                            .map((t) => (
                              <span className="tag" key={t}>
                                {t}
                              </span>
                            ))}
                      </div>
                    )}
                  </div>
                  <div className="card-actions">
                    <IconButton icon="share" label="Share application" onClick={() => setShare({ appId: app.id })} />
                    <IconButton icon="edit" label="Edit application" onClick={() => setModal({ kind: 'app', appId: app.id })} />
                    <IconButton icon="trash" label="Delete application" danger onClick={() => askDelete(app.id)} />
                  </div>
                </div>

                <div className="instances">
                  {app.instances.length === 0 && (
                    <div className="no-inst">No instances yet. Add a server, environment or login below.</div>
                  )}
                  {app.instances.map((inst) => {
                    const rows = instanceRows(inst);
                    const type = getType(inst.type);
                    // Collapsed by default; open when it's the only one or a search is active
                    const open = expanded[inst.id] ?? (app.instances.length === 1 || !!search.trim());
                    const url = rows.find((r) => r.kind === 'url');
                    return (
                      <article
                        className={'instance' + (flash === inst.id ? ' flash' : '')}
                        id={'item-' + inst.id}
                        key={inst.id}
                      >
                        <div className="inst-head">
                          <button
                            type="button"
                            className="inst-toggle"
                            aria-expanded={open}
                            aria-controls={'fields-' + inst.id}
                            title={open ? 'Collapse' : 'Show details'}
                            onClick={() => setExpanded((e) => ({ ...e, [inst.id]: !open }))}
                          >
                            <span className="chev">
                              <Icon name="chevronDown" size={14} />
                            </span>
                            <span className="inst-icon" title={type.label}>
                              <Icon name={type.icon} size={15} />
                            </span>
                            <strong className="inst-name">{inst.name}</strong>
                            <span className="inst-type">{type.label}</span>
                            {inst.environment && (
                              <span className={'badge env-' + inst.environment.toLowerCase()}>
                                <span className="dot" />
                                {inst.environment}
                              </span>
                            )}
                          </button>
                          {!open && url && (
                            <a
                              className="icon-btn sm"
                              href={href(url.value)}
                              target="_blank"
                              rel="noreferrer"
                              title={'Open ' + url.value}
                              aria-label={'Open ' + url.value}
                            >
                              <Icon name="external" size={14} />
                            </a>
                          )}
                          <IconButton
                            icon="share"
                            label="Share instance"
                            size="sm"
                            onClick={() => setShare({ appId: app.id, instId: inst.id })}
                          />
                          <IconButton
                            icon="edit"
                            label="Edit instance"
                            size="sm"
                            onClick={() => setModal({ kind: 'inst', appId: app.id, instId: inst.id })}
                          />
                          <IconButton
                            icon="trash"
                            label="Delete instance"
                            size="sm"
                            danger
                            onClick={() => askDelete(app.id, inst.id)}
                          />
                        </div>

                        {!open ? null : rows.length === 0 ? (
                          <p className="inst-empty" id={'fields-' + inst.id}>No details added.</p>
                        ) : (
                          <dl className="fields" id={'fields-' + inst.id}>
                            {rows.map((row) => {
                              const rid = inst.id + ':' + row.id;
                              const shown = !row.secret || !!revealed[rid];
                              return (
                                <div className="field" key={row.id}>
                                  <dt title={row.label}>{row.label}</dt>
                                  <dd>
                                    {row.kind === 'url' ? (
                                      <a className="val link" href={href(row.value)} target="_blank" rel="noreferrer">
                                        {row.value}
                                        <Icon name="external" size={12} />
                                      </a>
                                    ) : (
                                      <span
                                        className={
                                          'val' +
                                          (row.kind === 'notes' ? ' pre' : '') +
                                          (row.kind === 'mono' || row.secret ? ' mono' : '') +
                                          (shown ? '' : ' masked')
                                        }
                                      >
                                        {shown ? row.value : '••••••••••••'}
                                      </span>
                                    )}
                                    {(row.secret || row.copy) && (
                                      <span className="field-actions">
                                        {row.secret && (
                                          <IconButton
                                            icon={shown ? 'eyeOff' : 'eye'}
                                            label={shown ? 'Hide' : `Reveal for ${AUTO_HIDE_SECONDS}s`}
                                            size="sm"
                                            onClick={() => toggleReveal(rid)}
                                          />
                                        )}
                                        {row.copy && (
                                          <IconButton
                                            icon={copied === rid ? 'check' : 'copy'}
                                            label={'Copy ' + row.label}
                                            size="sm"
                                            success={copied === rid}
                                            onClick={() => copy(row.value, rid, row.label)}
                                          />
                                        )}
                                      </span>
                                    )}
                                  </dd>
                                </div>
                              );
                            })}
                          </dl>
                        )}
                      </article>
                    );
                  })}
                </div>

                <button className="add-inst" onClick={() => setModal({ kind: 'inst', appId: app.id })}>
                  <Icon name="plus" size={14} /> Add instance
                </button>
              </section>
            ))}
          </main>
        )}
      </div>

      <footer className="foot">
        <span>
          <Icon name="lock" size={13} /> Credentials stay hidden until revealed and re-hide after {AUTO_HIDE_SECONDS}s.
          Served on this computer only.
        </span>
        {fileName && (
          <span title={file}>
            <Icon name="file" size={13} /> {fileName}
          </span>
        )}
      </footer>

      {modal && (
        <FormModal
          title={
            modal.kind === 'app'
              ? modal.appId
                ? 'Edit application'
                : 'New application'
              : `${modal.instId ? 'Edit' : 'New'} instance`
          }
          subtitle={
            modal.kind === 'inst'
              ? modalApp?.name
              : 'Group the servers, storage and accounts that belong together.'
          }
          fields={modal.kind === 'app' ? APP_FORM : instForm}
          onTypeChange={modal.kind === 'inst' ? applyType : undefined}
          initial={modalInitial}
          submitLabel={(modal.kind === 'app' ? modal.appId : modal.instId) ? 'Save changes' : 'Create'}
          onCancel={() => setModal(null)}
          validate={validateModal}
          onSubmit={submitModal}
        />
      )}

      {confirm && <ConfirmModal {...confirm} onCancel={() => setConfirm(null)} />}

      {share && (() => {
        // Share from the full data, not the filtered view
        const app = apps.find((a) => a.id === share.appId);
        const inst = share.instId && app?.instances.find((i) => i.id === share.instId);
        return app && (!share.instId || inst) ? (
          <ShareModal app={app} inst={inst} notify={showToast} onClose={() => setShare(null)} />
        ) : null;
      })()}

      {toast && (
        <div className={'toast' + (toast.error ? ' error' : '')} role="status">
          <Icon name={toast.error ? 'alert' : 'check'} size={16} />
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function IconButton({ icon, label, onClick, danger, success, size }) {
  return (
    <button
      type="button"
      className={'icon-btn' + (size === 'sm' ? ' sm' : '') + (danger ? ' danger' : '') + (success ? ' success' : '')}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <Icon name={icon} size={size === 'sm' ? 14 : 16} />
    </button>
  );
}

// A dropdown can't sit inside <label>: label clicks would re-trigger its button
function Field({ as: Tag, ...props }) {
  return <Tag {...props} className={'field-wrap ' + (props.className || '')} />;
}

function useEscape(fn) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && fn();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fn]);
}

function ConfirmModal({ title, text, run, onCancel, confirmText }) {
  useEscape(onCancel);
  const [typed, setTyped] = useState('');
  const ok = !confirmText || typed.trim() === confirmText.trim();
  return (
    <div className="overlay" onMouseDown={onCancel}>
      <div className="modal modal-sm" role="alertdialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="confirm-body">
          <div className="confirm-icon">
            <Icon name="alert" size={20} />
          </div>
          <div>
            <h3>{title}</h3>
            <p>{text} This can’t be undone from the app.</p>
            {confirmText && (
              <form
                className="form confirm-type"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (ok) run();
                }}
              >
                <label className="form-label" htmlFor="confirm-name">
                  Type <strong className="confirm-name">{confirmText}</strong> to confirm
                </label>
                <input
                  id="confirm-name"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                />
              </form>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={run} disabled={!ok} autoFocus={!confirmText}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// `fields` is a list, or a function of the current values (the instance form changes with its type)
function FormModal({ title, subtitle, fields, initial, submitLabel, validate, onTypeChange, onCancel, onSubmit }) {
  const [values, setValues] = useState(() => {
    const { id, instances, ...rest } = initial || {};
    return rest.fields ? { ...rest, fields: rest.fields.map((f) => ({ ...f })) } : rest;
  });
  const list = typeof fields === 'function' ? fields(values) : fields;
  const [show, setShow] = useState({});
  const [error, setError] = useState(null); // shown under the name field
  useEscape(onCancel);

  const set = (k, v) => {
    if (k === 'name') setError(null);
    if (k === 'type' && onTypeChange) setValues((s) => onTypeChange(s, v));
    else setValues((s) => ({ ...s, [k]: v }));
  };

  const submit = (e) => {
    e.preventDefault();
    const trimmed = { ...values, name: (values.name || '').trim() };
    if (!trimmed.name) return;
    if (trimmed.fields) {
      trimmed.fields = trimmed.fields
        .filter((f) => f.label.trim() || f.value)
        .map((f) => ({ label: f.label.trim() || 'Untitled', value: f.value, secret: !!f.secret }));
    }
    const err = validate?.(trimmed);
    if (err) return setError(err);
    onSubmit(trimmed);
  };

  return (
    <div className="overlay" onMouseDown={onCancel}>
      <form className="modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton icon="x" label="Close" onClick={onCancel} />
        </div>
        <div className="modal-body form">
          {list.map((f, idx) =>
            f.custom ? (
              <CustomFields key="custom" fields={values.fields || []} onChange={(v) => set('fields', v)} />
            ) : f.section ? (
              <div className="form-section" key={f.section}>
                {f.section}
              </div>
            ) : (
              <Field key={f.key} as={f.type === 'select' ? 'div' : 'label'} className={f.type === 'textarea' || f.full ? 'full' : ''}>
                <span className="form-label">
                  {f.label}
                  {f.required && <em> *</em>}
                </span>
                {f.type === 'textarea' ? (
                  <textarea
                    rows={3}
                    placeholder={f.placeholder}
                    value={values[f.key] ?? ''}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                ) : f.type === 'select' ? (
                  <Dropdown
                    value={values[f.key] ?? ''}
                    onChange={(v) => set(f.key, v)}
                    label={f.label}
                    options={f.options}
                  />
                ) : f.secret ? (
                  <div className="secret-input">
                    <input
                      type={show[f.key] ? 'text' : 'password'}
                      autoComplete="new-password"
                      spellCheck={false}
                      value={values[f.key] ?? ''}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                    <button
                      type="button"
                      className="secret-toggle"
                      onClick={() => setShow((s) => ({ ...s, [f.key]: !s[f.key] }))}
                      aria-label={show[f.key] ? 'Hide value' : 'Show value'}
                      title={show[f.key] ? 'Hide value' : 'Show value'}
                    >
                      <Icon name={show[f.key] ? 'eyeOff' : 'eye'} size={15} />
                    </button>
                  </div>
                ) : (
                  <input
                    autoFocus={idx === 0}
                    required={f.required}
                    placeholder={f.placeholder}
                    value={values[f.key] ?? ''}
                    onChange={(e) => set(f.key, e.target.value)}
                    className={f.key === 'name' && error ? 'invalid' : ''}
                    aria-invalid={f.key === 'name' && !!error}
                  />
                )}
                {f.key === 'name' && error && (
                  <span className="form-error" role="alert">
                    <Icon name="alert" size={13} /> {error}
                  </span>
                )}
              </Field>
            )
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

// Free-form fields on an instance: label, value, and whether the value is a secret
function CustomFields({ fields, onChange }) {
  const update = (i, patch) => onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <div className="custom-fields full">
      {fields.length > 0 && (
        <div className="cf-list">
          {fields.map((f, i) => (
            <div className="cf-row" key={i}>
              <input
                className="cf-label"
                placeholder="Field name"
                value={f.label}
                onChange={(e) => update(i, { label: e.target.value })}
                aria-label="Field name"
              />
              <input
                className={'cf-value' + (f.secret ? ' mono' : '')}
                type={f.secret ? 'password' : 'text'}
                autoComplete={f.secret ? 'new-password' : 'off'}
                spellCheck={false}
                placeholder="Value"
                value={f.value}
                onChange={(e) => update(i, { value: e.target.value })}
                aria-label={(f.label || 'Field') + ' value'}
              />
              <button
                type="button"
                className={'cf-btn' + (f.secret ? ' on' : '')}
                onClick={() => update(i, { secret: !f.secret })}
                title={f.secret ? 'Secret: hidden until revealed' : 'Not secret: click to hide this value'}
                aria-label={f.secret ? 'Mark as not secret' : 'Mark as secret'}
                aria-pressed={!!f.secret}
              >
                <Icon name={f.secret ? 'lock' : 'unlock'} size={14} />
              </button>
              <button
                type="button"
                className="cf-btn danger"
                onClick={() => onChange(fields.filter((_, j) => j !== i))}
                title="Remove field"
                aria-label="Remove field"
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="cf-add" onClick={() => onChange([...fields, { label: '', value: '', secret: false }])}>
        <Icon name="plus" size={14} /> Add field
      </button>
    </div>
  );
}

function ShareModal({ app, inst, notify, onClose }) {
  const [markdown, setMarkdown] = useState(false);
  const [includeSecrets, setIncludeSecrets] = useState(false);
  useEscape(onClose);

  const text = shareText({ app, inst, markdown, includeSecrets });
  const secretsExist = hasSecrets(inst ? [inst] : app.instances);
  const name = inst ? `${app.name} ${inst.name}` : app.name;
  const canShare = typeof navigator.share === 'function';

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      notify('Copied, ready to paste');
    } catch {
      notify('Copy failed', true);
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: markdown ? 'text/markdown' : 'text/plain' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: slug(name) + (markdown ? '.md' : '.txt') });
    a.click();
    URL.revokeObjectURL(url);
  };

  const systemShare = async () => {
    try {
      await navigator.share({ title: name, text });
    } catch (e) {
      if (e.name !== 'AbortError') notify('Sharing failed', true);
    }
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>Share {inst ? 'instance' : 'application'}</h3>
            <p>{inst ? `${inst.name} · ${app.name}` : `${app.name} · ${plural(app.instances.length, 'instance')}`}</p>
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div className="modal-body share-body">
          <div className="share-controls">
            <div className="segmented" role="tablist" aria-label="Format">
              <button className={!markdown ? 'active' : ''} onClick={() => setMarkdown(false)}>
                Plain text
              </button>
              <button className={markdown ? 'active' : ''} onClick={() => setMarkdown(true)}>
                Markdown
              </button>
            </div>
            {secretsExist && (
              <label className="switch">
                <input type="checkbox" checked={includeSecrets} onChange={(e) => setIncludeSecrets(e.target.checked)} />
                <span className="switch-track" />
                Include passwords &amp; secrets
              </label>
            )}
          </div>
          {includeSecrets && (
            <div className="share-warning" role="alert">
              <Icon name="alert" size={15} />
              Anyone who receives this will see these credentials. Send it only over a channel you trust.
            </div>
          )}
          <pre className="share-preview" tabIndex={0} aria-label="Preview">
            {text}
          </pre>
        </div>
        <div className="modal-foot">
          <button className="btn btn-secondary" onClick={download}>
            <Icon name="download" /> Download
          </button>
          {canShare && (
            <button className="btn btn-secondary" onClick={systemShare}>
              <Icon name="share" /> Share…
            </button>
          )}
          <button className="btn btn-primary" onClick={copyText} autoFocus>
            <Icon name="copy" /> Copy
          </button>
        </div>
      </div>
    </div>
  );
}
