import type { ReportData } from '../types/index.js';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  major: '#ea580c',
  minor: '#ca8a04',
  cosmetic: '#6b7280',
};

const CONTEXT_COLORS = ['#0d9488', '#7c3aed', '#d97706', '#e11d48', '#0284c7', '#65a30d'];

function contextColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return CONTEXT_COLORS[Math.abs(hash) % CONTEXT_COLORS.length];
}

export async function generate(
  data: ReportData,
  screenshotResolver: (stepId: string) => Promise<string | null>,
): Promise<string> {
  const { summary, bugs, findings, session } = data;

  // Collect evidence screenshots
  const screenshots = new Map<string, string>();
  const allEvidenceIds = new Set<string>();
  for (const bug of bugs) {
    bug.evidenceStepIds.forEach((id) => allEvidenceIds.add(id));
  }
  for (const finding of findings) {
    finding.evidenceStepIds.forEach((id) => allEvidenceIds.add(id));
  }
  for (const stepId of allEvidenceIds) {
    const b64 = await screenshotResolver(stepId);
    if (b64) screenshots.set(stepId, b64);
  }

  // Build HTML
  const bugsHtml = bugs
    .map((bug) => {
      const color = SEVERITY_COLORS[bug.severity] ?? '#6b7280';
      const stepsHtml = bug.stepsToReproduce.map((s, _i) => `<li>${escapeHtml(s)}</li>`).join('');
      const evidenceHtml = bug.evidenceStepIds
        .map((id) => {
          const b64 = screenshots.get(id);
          if (!b64) return '';
          return `<div class="screenshot"><img src="data:image/png;base64,${b64}" alt="Evidence ${id}" /></div>`;
        })
        .join('');

      return `
      <div class="bug-card">
        <div class="bug-header">
          <span class="severity" style="background:${color}">${bug.severity.toUpperCase()}</span>
          ${bug.contextId ? `<span class="context-badge" style="background:${contextColor(bug.contextId)}">${escapeHtml(bug.contextId)}</span>` : ''}
          <h3>${escapeHtml(bug.title)}</h3>
        </div>
        ${bug.url ? `<p class="url">${escapeHtml(bug.url)}</p>` : ''}
        <div class="section">
          <h4>Steps to Reproduce</h4>
          <ol>${stepsHtml}</ol>
        </div>
        <div class="columns">
          <div class="section">
            <h4>Expected</h4>
            <p>${escapeHtml(bug.expected)}</p>
          </div>
          <div class="section">
            <h4>Actual</h4>
            <p>${escapeHtml(bug.actual)}</p>
          </div>
        </div>
        ${bug.rootCause ? `<div class="section"><h4>Root Cause</h4><p>${escapeHtml(bug.rootCause)}</p></div>` : ''}
        ${evidenceHtml}
      </div>`;
    })
    .join('');

  const findingsHtml = findings
    .map((f) => {
      const evidenceHtml = f.evidenceStepIds
        .map((id) => {
          const b64 = screenshots.get(id);
          if (!b64) return '';
          return `<div class="screenshot"><img src="data:image/png;base64,${b64}" alt="Evidence ${id}" /></div>`;
        })
        .join('');

      return `
      <div class="finding-card">
        <div class="finding-header">
          <span class="category">${f.category.toUpperCase()}</span>
          ${f.contextId ? `<span class="context-badge" style="background:${contextColor(f.contextId)}">${escapeHtml(f.contextId)}</span>` : ''}
          <h3>${escapeHtml(f.title)}</h3>
        </div>
        ${f.url ? `<p class="url">${escapeHtml(f.url)}</p>` : ''}
        <p>${escapeHtml(f.description)}</p>
        ${evidenceHtml}
      </div>`;
    })
    .join('');

  const hasContexts = session.steps.some((s) => s.contextId);

  const timelineRows = session.steps
    .map((step, i) => {
      const err = step.error ? `<span class="error-badge">Error</span>` : '';
      const ctxCell = hasContexts
        ? `<td><span class="context-badge" style="background:${contextColor(step.contextId ?? 'default')}">${escapeHtml(step.contextId ?? 'default')}</span></td>`
        : '';
      return `<tr>
        <td>${i + 1}</td>
        ${ctxCell}
        <td><code>${step.action.type}</code></td>
        <td class="url-cell">${escapeHtml(step.metadata.url)}</td>
        <td>${step.duration}ms</td>
        <td>${err}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QA Report - ${escapeHtml(summary.sessionId)}</title>
  <style>
    :root { --bg: #ffffff; --fg: #1a1a2e; --muted: #6b7280; --border: #e5e7eb; --accent: #2563eb; --card-bg: #f9fafb; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: var(--fg); background: var(--bg); line-height: 1.6; max-width: 960px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
    h2 { font-size: 1.35rem; margin: 2rem 0 1rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem; }
    h3 { font-size: 1.1rem; margin: 0; }
    h4 { font-size: 0.85rem; text-transform: uppercase; color: var(--muted); margin-bottom: 0.25rem; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
    .stat { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; text-align: center; }
    .stat .value { font-size: 1.5rem; font-weight: 700; }
    .stat .label { font-size: 0.8rem; color: var(--muted); }
    .bug-card, .finding-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; }
    .bug-header, .finding-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; }
    .severity, .category { color: #fff; font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 4px; text-transform: uppercase; white-space: nowrap; }
    .category { background: var(--accent); }
    .url { font-size: 0.85rem; color: var(--muted); margin-bottom: 0.75rem; word-break: break-all; }
    .section { margin-bottom: 0.75rem; }
    .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .screenshot { margin: 0.75rem 0; }
    .screenshot img { max-width: 100%; border: 1px solid var(--border); border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); }
    th { font-weight: 600; color: var(--muted); font-size: 0.75rem; text-transform: uppercase; }
    .url-cell { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    code { background: #e5e7eb; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.85em; }
    .error-badge { background: #fef2f2; color: #dc2626; padding: 0.15rem 0.5rem; border-radius: 3px; font-size: 0.75rem; font-weight: 600; }
    ol { padding-left: 1.25rem; }
    li { margin-bottom: 0.25rem; }
    .meta { color: var(--muted); font-size: 0.85rem; margin-bottom: 1.5rem; }
    .context-badge { color: #fff; font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 3px; font-family: monospace; white-space: nowrap; }
  </style>
</head>
<body>
  <h1>QA Report</h1>
  <p class="meta">Session <code>${escapeHtml(summary.sessionId)}</code> &mdash; ${new Date(summary.startTime).toISOString()}</p>

  <div class="summary">
    <div class="stat"><div class="value">${summary.stepCount}</div><div class="label">Steps</div></div>
    <div class="stat"><div class="value">${(summary.duration / 1000).toFixed(1)}s</div><div class="label">Duration</div></div>
    <div class="stat"><div class="value">${summary.bugCount}</div><div class="label">Bugs</div></div>
    <div class="stat"><div class="value">${summary.findingCount}</div><div class="label">Findings</div></div>
    <div class="stat"><div class="value">${summary.errorStepCount}</div><div class="label">Errors</div></div>
    ${summary.contexts && summary.contexts.length > 1 ? `<div class="stat"><div class="value">${summary.contexts.length}</div><div class="label">Actors</div></div>` : ''}
  </div>

  ${bugs.length > 0 ? `<h2>Bugs</h2>${bugsHtml}` : ''}
  ${findings.length > 0 ? `<h2>Findings</h2>${findingsHtml}` : ''}
  ${
    session.steps.length > 0
      ? `
  <h2>Timeline</h2>
  <table>
    <thead><tr><th>#</th>${hasContexts ? '<th>Context</th>' : ''}<th>Action</th><th>URL</th><th>Duration</th><th>Status</th></tr></thead>
    <tbody>${timelineRows}</tbody>
  </table>`
      : ''
  }

  <p class="meta" style="margin-top:2rem; text-align:center;">Generated by f4tl at ${new Date(data.generatedAt).toISOString()}</p>
</body>
</html>`;
}
