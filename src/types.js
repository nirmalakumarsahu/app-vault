// Instance types. Each type picks which standard fields it shows (optionally relabelled)
// and which custom fields a new instance of that type starts with.
// Custom fields are stored per instance, so you can add/rename/remove them freely.

export const STANDARD = {
  url: { label: 'URL', placeholder: 'https://…', full: true },
  host: { label: 'Host / IP', placeholder: '10.0.0.5', mono: true },
  port: { label: 'Port', placeholder: '22', mono: true },
  username: { label: 'Username', secret: true },
  password: { label: 'Password', secret: true },
  apiKey: { label: 'API Key', secret: true, full: true },
  notes: { label: 'Notes', type: 'textarea' },
};

export const TYPES = [
  {
    label: 'Server',
    icon: 'server',
    std: ['url', 'host', 'port', 'username', 'password', 'apiKey', 'notes'],
    custom: [],
  },
  {
    label: 'AWS S3',
    icon: 'cloud',
    std: [{ key: 'url', label: 'Console URL' }, 'notes'],
    custom: [
      { label: 'Bucket' },
      { label: 'Region' },
      { label: 'Access Key ID' },
      { label: 'Secret Access Key', secret: true },
      { label: 'Endpoint' },
    ],
  },
  {
    label: 'Account',
    icon: 'user',
    std: [{ key: 'url', label: 'Login URL' }, 'username', 'password', 'notes'],
    custom: [{ label: 'Email' }, { label: 'Recovery Codes', secret: true }],
  },
  {
    label: 'Database',
    icon: 'database',
    std: ['host', 'port', 'username', 'password', 'notes'],
    custom: [{ label: 'Database Name' }, { label: 'Engine' }],
  },
  { label: 'Custom', icon: 'box', std: ['notes'], custom: [] },
];

const SERVER = TYPES[0];
const CUSTOM = TYPES[TYPES.length - 1];

// Older entries have no type: they were all servers
export const getType = (label) => TYPES.find((t) => t.label === label) || (label ? CUSTOM : SERVER);

const norm = (s) => String(s || '').trim().toLowerCase();

// Standard fields for an instance: the type's own, plus any other standard field that already has a value
export function standardFields(inst) {
  const t = getType(inst.type);
  const own = t.std.map((s) => (typeof s === 'string' ? { key: s } : s));
  const ownKeys = own.map((s) => s.key);
  const extra = Object.keys(STANDARD)
    .filter((k) => !ownKeys.includes(k) && inst[k])
    .map((key) => ({ key }));
  return [...own, ...extra].map((s) => ({ ...STANDARD[s.key], ...s }));
}

// Rows shown on an instance card, in display order (notes last)
export function instanceRows(inst) {
  const std = standardFields(inst).filter((f) => inst[f.key]);
  const rows = std
    .filter((f) => f.key !== 'notes')
    .map((f) => ({
      id: f.key,
      label: f.label,
      value: inst[f.key],
      secret: !!f.secret,
      kind: f.key === 'url' ? 'url' : f.mono ? 'mono' : 'text',
      copy: f.secret || ['url', 'host'].includes(f.key),
    }));
  (inst.fields || []).forEach((f, i) => {
    if (f.value)
      rows.push({ id: 'f' + i, label: f.label, value: f.value, secret: !!f.secret, kind: 'mono', copy: true });
  });
  if (inst.notes) rows.push({ id: 'notes', label: 'Notes', value: inst.notes, kind: 'notes' });
  return rows;
}

// When the type changes in the form: keep filled-in custom fields, drop empty ones the new type
// doesn't use, and add the new type's presets.
export function applyType(values, typeLabel) {
  const t = getType(typeLabel);
  const current = values.fields || [];
  const presets = t.custom.map((p) => current.find((f) => norm(f.label) === norm(p.label)) || { ...p, value: '' });
  const kept = current.filter((f) => f.value && !presets.includes(f));
  return { ...values, type: t.label, fields: [...presets, ...kept] };
}

// Text that search may look at — never secret values
export function searchText(inst) {
  return [
    inst.name,
    inst.environment,
    getType(inst.type).label,
    inst.url,
    inst.host,
    inst.notes,
    ...(inst.fields || []).flatMap((f) => (f.secret ? [f.label] : [f.label, f.value])),
  ]
    .join(' ')
    .toLowerCase();
}
