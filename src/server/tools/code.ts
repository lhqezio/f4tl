import { z } from 'zod';
import type { CodeExplorer } from '../../core/code-explorer.js';
import type { ToolResult } from '../../types/index.js';

// ── Schemas ──────────────────────────────────────────────────────────────────

export const searchSchema = z.object({
  pattern: z.string().describe('Regex search pattern'),
  glob: z.string().optional().describe('Glob to filter files (e.g. "*.ts", "src/**/*.tsx")'),
  caseSensitive: z.boolean().default(false).describe('Case-sensitive search'),
  maxResults: z.number().default(50).describe('Max matches to return'),
  contextLines: z.number().default(0).describe('Lines of context around matches'),
});

export const readFileSchema = z.object({
  path: z.string().describe('File path relative to project root'),
  startLine: z.number().optional().describe('Start line (1-based)'),
  endLine: z.number().optional().describe('End line (1-based, inclusive)'),
});

export const findFilesSchema = z.object({
  pattern: z.string().describe('Glob pattern (e.g. "**/*.ts", "src/**/*.test.*")'),
  maxResults: z.number().default(200).describe('Max files to return'),
});

export const gitDiffSchema = z.object({
  ref: z.string().optional().describe('Git ref to diff against (e.g. HEAD~3, main)'),
  staged: z.boolean().default(false).describe('Show staged changes only'),
});

// ── Tool Class ───────────────────────────────────────────────────────────────

export class CodeTools {
  constructor(private explorer: CodeExplorer) {}

  async search(params: z.infer<typeof searchSchema>): Promise<ToolResult> {
    try {
      const matches = await this.explorer.search(params.pattern, {
        glob: params.glob,
        caseSensitive: params.caseSensitive,
        maxResults: params.maxResults,
        contextLines: params.contextLines,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                pattern: params.pattern,
                count: matches.length,
                matches: matches.map((m) => ({
                  file: m.file,
                  line: m.line,
                  column: m.column,
                  text: m.text,
                })),
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

  async readFile(params: z.infer<typeof readFileSchema>): Promise<ToolResult> {
    try {
      const result = await this.explorer.readFile(params.path, {
        startLine: params.startLine,
        endLine: params.endLine,
      });

      return {
        content: [
          {
            type: 'text',
            text: `File: ${result.path} (${result.totalLines} lines)\n\n${result.content}`,
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

  async findFiles(params: z.infer<typeof findFilesSchema>): Promise<ToolResult> {
    try {
      const files = await this.explorer.findFiles(params.pattern, {
        maxResults: params.maxResults,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ pattern: params.pattern, count: files.length, files }, null, 2),
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

  async gitDiff(params: z.infer<typeof gitDiffSchema>): Promise<ToolResult> {
    try {
      const result = await this.explorer.gitDiff({
        ref: params.ref,
        staged: params.staged,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                totalAdditions: result.totalAdditions,
                totalDeletions: result.totalDeletions,
                fileCount: result.files.length,
                files: result.files.map((f) => ({
                  path: f.path,
                  additions: f.additions,
                  deletions: f.deletions,
                  patch: f.patch,
                })),
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
}
