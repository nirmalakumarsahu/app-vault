// Builds shareable text for an application or a single instance.
// Secret values are left out unless includeSecrets is on.
import { getType, instanceRows } from './types.js';

const HIDDEN = '(not shared)';

function instanceLines(inst, { markdown, includeSecrets }) {
  const meta = [getType(inst.type).label, inst.environment].filter(Boolean).join(' · ');
  const rows = instanceRows(inst).map((r) => ({ ...r, value: r.secret && !includeSecrets ? HIDDEN : r.value }));
  if (markdown) {
    return [
      `### ${inst.name}`,
      ...(meta ? [`_${meta}_`] : []),
      ...(rows.length ? [''] : []),
      ...rows.map((r) =>
        r.kind === 'notes'
          ? `- **${r.label}:**\n  ${r.value.replace(/\n/g, '\n  ')}`
          : `- **${r.label}:** ${r.secret && includeSecrets ? '`' + r.value + '`' : r.value}`
      ),
    ];
  }
  return [
    `${inst.name}${meta ? ` (${meta})` : ''}`,
    ...rows.map((r) => (r.kind === 'notes' ? `  ${r.label}:\n    ${r.value.replace(/\n/g, '\n    ')}` : `  ${r.label}: ${r.value}`)),
  ];
}

export function shareText({ app, inst, markdown, includeSecrets }) {
  const opts = { markdown, includeSecrets };
  if (inst) return [...(markdown ? [`**${app.name}**`, ''] : [`${app.name}`, '']), ...instanceLines(inst, opts)].join('\n');

  const head = markdown
    ? [
        `## ${app.name}`,
        app.description,
        app.owner && `**Owner:** ${app.owner}`,
        app.tags && `**Tags:** ${app.tags}`,
      ]
    : [app.name, app.description, app.owner && `Owner: ${app.owner}`, app.tags && `Tags: ${app.tags}`];
  const blocks = app.instances.map((i) => instanceLines(i, opts).join('\n'));
  return [head.filter(Boolean).join(markdown ? '\n\n' : '\n'), ...blocks].join('\n\n');
}

// Does this application / instance hold any secret values at all?
export const hasSecrets = (insts) => insts.some((i) => instanceRows(i).some((r) => r.secret));

export const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'share';
