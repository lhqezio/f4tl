import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ReportManager } from '../../core/report-manager.js';
import type { SessionManager } from '../../core/session-manager.js';
import type { ToolResult } from '../../types/index.js';

// ── Schemas ──────────────────────────────────────────────────────────────────

export const createBugSchema = z.object({
  title: z.string().describe('Bug title/summary'),
  severity: z.enum(['critical', 'major', 'minor', 'cosmetic']).describe('Bug severity'),
  stepsToReproduce: z.array(z.string()).describe('Ordered steps to reproduce'),
  expected: z.string().describe('Expected behavior'),
  actual: z.string().describe('Actual behavior observed'),
  rootCause: z.string().optional().describe('Suspected root cause'),
  evidenceStepIds: z
    .array(z.string())
    .default([])
    .describe('Step IDs with screenshots as evidence'),
  url: z.string().optional().describe('URL where the bug was found'),
});

export const addFindingSchema = z.object({
  title: z.string().describe('Finding title'),
  category: z
    .enum(['usability', 'performance', 'accessibility', 'security', 'suggestion', 'observation'])
    .describe('Finding category'),
  description: z.string().describe('Detailed description'),
  evidenceStepIds: z.array(z.string()).default([]).describe('Step IDs as evidence'),
  url: z.string().optional().describe('Relevant URL'),
});

export const generateReportSchema = z.object({
  format: z.enum(['markdown', 'json', 'html']).default('markdown').describe('Report output format'),
});

// ── Tool Class ───────────────────────────────────────────────────────────────

export class ReportTools {
  constructor(
    private rm: ReportManager,
    private sm: SessionManager,
    private sessionOutputDir: string,
  ) {}

  async createBug(params: z.infer<typeof createBugSchema>): Promise<ToolResult> {
    try {
      const bug = this.rm.createBug(params);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'created',
                bugId: bug.id,
                severity: bug.severity,
                title: bug.title,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }

  async addFinding(params: z.infer<typeof addFindingSchema>): Promise<ToolResult> {
    try {
      const finding = this.rm.addFinding(params);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'created',
                findingId: finding.id,
                category: finding.category,
                title: finding.title,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }

  async generateReport(params: z.infer<typeof generateReportSchema>): Promise<ToolResult> {
    try {
      const session = this.sm.getSession();
      if (!session) throw new Error('No active session');

      const sessionDir = join(this.sessionOutputDir, session.id);
      const screenshotResolver = async (stepId: string): Promise<string | null> => {
        try {
          const buf = await readFile(join(sessionDir, `${stepId}.png`));
          return buf.toString('base64');
        } catch {
          // Also check in-memory session steps
          const step = session.steps.find((s) => s.id === stepId);
          return step?.screenshot ?? null;
        }
      };

      const outputPath = await this.rm.generateReport(session, params.format, screenshotResolver);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'generated',
                format: params.format,
                outputPath,
                bugCount: this.rm.getBugs().length,
                findingCount: this.rm.getFindings().length,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }

  async getSessionSummary(): Promise<ToolResult> {
    try {
      const session = this.sm.getSession();
      if (!session) throw new Error('No active session');
      const summary = this.rm.getSummary(session);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
}
