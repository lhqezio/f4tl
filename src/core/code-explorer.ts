import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import fg from 'fast-glob';
import type { CodebaseConfig, SearchMatch, GitDiffFile, GitDiffResult } from '../types/index.js';

export class CodeExplorer {
  constructor(private config: CodebaseConfig) {}

  async search(
    pattern: string,
    opts?: {
      glob?: string;
      caseSensitive?: boolean;
      maxResults?: number;
      contextLines?: number;
    },
  ): Promise<SearchMatch[]> {
    const args = ['--json', '--no-heading'];

    if (!opts?.caseSensitive) args.push('-i');
    if (opts?.contextLines) args.push(`-C`, String(opts.contextLines));
    if (opts?.maxResults) args.push('--max-count', String(opts.maxResults));
    if (opts?.glob) args.push('--glob', opts.glob);

    for (const exclude of this.config.excludePatterns) {
      args.push('--glob', `!${exclude}`);
    }

    args.push(pattern, this.config.projectRoot);

    const output = await this.spawnProcess('rg', args);
    return this.parseRipgrepOutput(output);
  }

  async readFile(
    filePath: string,
    opts?: { startLine?: number; endLine?: number },
  ): Promise<{ path: string; content: string; totalLines: number }> {
    const absPath = this.resolvePath(filePath);
    const content = await readFile(absPath, 'utf-8');
    const lines = content.split('\n');

    const start = Math.max(0, (opts?.startLine ?? 1) - 1);
    const end = opts?.endLine ?? lines.length;
    const sliced = lines.slice(start, end);

    return {
      path: relative(this.config.projectRoot, absPath),
      content: sliced.map((line, i) => `${start + i + 1}:${line}`).join('\n'),
      totalLines: lines.length,
    };
  }

  async findFiles(pattern: string, opts?: { maxResults?: number }): Promise<string[]> {
    const ignore = this.config.excludePatterns;
    const files = await fg(pattern, {
      cwd: this.config.projectRoot,
      ignore,
      dot: false,
      absolute: false,
      onlyFiles: true,
    });

    const limit = opts?.maxResults ?? 500;
    return files.slice(0, limit).sort();
  }

  async gitDiff(opts?: {
    ref?: string;
    staged?: boolean;
    nameOnly?: boolean;
  }): Promise<GitDiffResult> {
    const args = ['diff'];

    if (opts?.staged) args.push('--staged');
    if (opts?.ref) args.push(opts.ref);
    args.push('--stat', '--patch');

    const output = await this.spawnProcess('git', args, this.config.projectRoot);
    return this.parseGitDiff(output);
  }

  private resolvePath(filePath: string): string {
    const abs = isAbsolute(filePath) ? filePath : resolve(this.config.projectRoot, filePath);

    // Path traversal protection
    const rel = relative(this.config.projectRoot, abs);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new Error(`Path "${filePath}" is outside the project root.`);
    }

    return abs;
  }

  private parseRipgrepOutput(output: string): SearchMatch[] {
    const matches: SearchMatch[] = [];
    const lines = output.split('\n').filter(Boolean);

    for (const line of lines) {
      try {
        const obj = JSON.parse(line) as {
          type: string;
          data?: {
            path?: { text?: string };
            line_number?: number;
            submatches?: { start?: number }[];
            lines?: { text?: string };
          };
        };
        if (obj.type !== 'match' || !obj.data) continue;

        matches.push({
          file: relative(this.config.projectRoot, obj.data.path?.text ?? ''),
          line: obj.data.line_number ?? 0,
          column: obj.data.submatches?.[0]?.start ?? 0,
          text: (obj.data.lines?.text ?? '').trimEnd(),
        });
      } catch {
        // Skip non-JSON lines
      }
    }

    return matches;
  }

  private parseGitDiff(output: string): GitDiffResult {
    const files: GitDiffFile[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    // Parse --stat section for file-level stats
    const statRegex = /^\s*(.+?)\s+\|\s+(\d+)\s+([+-]+)/gm;
    let m: RegExpExecArray | null;

    while ((m = statRegex.exec(output)) !== null) {
      const path = m[1].trim();
      const adds = (m[3].match(/\+/g) ?? []).length;
      const dels = (m[3].match(/-/g) ?? []).length;
      totalAdditions += adds;
      totalDeletions += dels;

      // Find the corresponding patch
      const patchRegex = new RegExp(
        `diff --git a/${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} b/${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s\\S]*?)(?=diff --git|$)`,
      );
      const patchMatch = patchRegex.exec(output);

      files.push({
        path,
        additions: adds,
        deletions: dels,
        patch: patchMatch ? patchMatch[0].trim() : '',
      });
    }

    return { files, totalAdditions, totalDeletions };
  }

  private spawnProcess(cmd: string, args: string[], cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, {
        cwd: cwd ?? this.config.projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30_000,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        // rg exits 1 when no matches found — that's OK
        if (code === 0 || (cmd === 'rg' && code === 1)) {
          resolve(stdout);
        } else {
          reject(new Error(`${cmd} exited with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn ${cmd}: ${err.message}`));
      });
    });
  }
}
