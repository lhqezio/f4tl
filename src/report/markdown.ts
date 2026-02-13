import type { ReportData } from '../types/index.js';

export async function generate(
  data: ReportData,
  _screenshotResolver: (stepId: string) => Promise<string | null>,
): Promise<string> {
  const { summary, bugs, findings, session } = data;
  const lines: string[] = [];

  lines.push(`# QA Report: Session ${summary.sessionId}`);
  lines.push('');
  lines.push(`**Date**: ${new Date(summary.startTime).toISOString()}`);
  lines.push(`**Duration**: ${(summary.duration / 1000).toFixed(1)}s`);
  lines.push(`**Steps**: ${summary.stepCount}`);
  lines.push(
    `**Bugs**: ${summary.bugCount} (${summary.bugsBySeverity.critical} critical, ${summary.bugsBySeverity.major} major, ${summary.bugsBySeverity.minor} minor, ${summary.bugsBySeverity.cosmetic} cosmetic)`,
  );
  lines.push(`**Findings**: ${summary.findingCount}`);
  lines.push(`**Errors**: ${summary.errorStepCount} step(s) with errors`);
  lines.push('');

  if (bugs.length > 0) {
    lines.push('## Bugs');
    lines.push('');
    for (const bug of bugs) {
      lines.push(`### [${bug.severity.toUpperCase()}] ${bug.title}`);
      lines.push('');
      if (bug.url) lines.push(`**URL**: ${bug.url}`);
      lines.push('');
      lines.push('**Steps to Reproduce**:');
      bug.stepsToReproduce.forEach((step, i) => {
        lines.push(`${i + 1}. ${step}`);
      });
      lines.push('');
      lines.push(`**Expected**: ${bug.expected}`);
      lines.push('');
      lines.push(`**Actual**: ${bug.actual}`);
      if (bug.rootCause) {
        lines.push('');
        lines.push(`**Root Cause**: ${bug.rootCause}`);
      }
      if (bug.evidenceStepIds.length > 0) {
        lines.push('');
        lines.push(`**Evidence**: Steps ${bug.evidenceStepIds.join(', ')}`);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  if (findings.length > 0) {
    lines.push('## Findings');
    lines.push('');
    for (const f of findings) {
      lines.push(`### [${f.category.toUpperCase()}] ${f.title}`);
      lines.push('');
      lines.push(f.description);
      if (f.url) {
        lines.push('');
        lines.push(`**URL**: ${f.url}`);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  if (session.steps.length > 0) {
    lines.push('## Timeline');
    lines.push('');
    lines.push('| # | Action | URL | Duration | Error |');
    lines.push('|---|--------|-----|----------|-------|');
    for (const [i, step] of session.steps.entries()) {
      const err = step.error ? `Yes: ${step.error.slice(0, 50)}` : '';
      const url =
        step.metadata.url.length > 60 ? step.metadata.url.slice(0, 57) + '...' : step.metadata.url;
      lines.push(`| ${i + 1} | ${step.action.type} | ${url} | ${step.duration}ms | ${err} |`);
    }
  }

  return lines.join('\n');
}
