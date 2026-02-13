import { useState, useMemo } from 'react';
import type { SessionStep } from '../lib/api';
import ScreenshotViewer from './ScreenshotViewer';

const CONTEXT_COLORS = [
  'bg-teal-500/20 text-teal-400 border-teal-500/40',
  'bg-violet-500/20 text-violet-400 border-violet-500/40',
  'bg-amber-500/20 text-amber-400 border-amber-500/40',
  'bg-rose-500/20 text-rose-400 border-rose-500/40',
  'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
  'bg-lime-500/20 text-lime-400 border-lime-500/40',
];

function contextColorClass(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return CONTEXT_COLORS[Math.abs(hash) % CONTEXT_COLORS.length];
}

interface Props {
  steps: SessionStep[];
  sessionId: string;
}

export default function StepTimeline({ steps, sessionId }: Props) {
  const contextNames = useMemo(
    () => [...new Set(steps.filter((s) => s.contextId).map((s) => s.contextId as string))],
    [steps],
  );
  const hasContexts = contextNames.length > 0;
  const [activeContexts, setActiveContexts] = useState<Set<string> | null>(null);

  // Initialize filter to show all on first render
  const effectiveFilter = activeContexts ?? new Set([...contextNames, 'default']);

  const filteredSteps = hasContexts
    ? steps.filter((s) => effectiveFilter.has(s.contextId ?? 'default'))
    : steps;

  if (steps.length === 0) {
    return <p className="text-sm text-gray-500">No steps recorded yet.</p>;
  }

  const toggleContext = (name: string) => {
    const next = new Set(effectiveFilter);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setActiveContexts(next);
  };

  return (
    <div className="space-y-2">
      {hasContexts && (
        <div className="flex gap-1.5 flex-wrap mb-2">
          {contextNames.map((name) => (
            <button
              key={name}
              onClick={() => toggleContext(name)}
              className={`px-2 py-0.5 rounded text-xs font-mono border transition-opacity ${contextColorClass(name)} ${
                effectiveFilter.has(name) ? 'opacity-100' : 'opacity-30'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400 border-b border-gray-800">
            <th className="py-2 text-left w-10">#</th>
            {hasContexts && <th className="py-2 text-left w-24">Context</th>}
            <th className="py-2 text-left">Action</th>
            <th className="py-2 text-left">URL</th>
            <th className="py-2 text-right w-20">Duration</th>
            <th className="py-2 text-left w-32">Error</th>
            <th className="py-2 text-center w-16">Screenshot</th>
          </tr>
        </thead>
        <tbody>
          {filteredSteps.map((step, i) => (
            <tr key={step.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
              <td className="py-2 text-gray-500">{i + 1}</td>
              {hasContexts && (
                <td className="py-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-mono border ${contextColorClass(step.contextId ?? 'default')}`}
                  >
                    {step.contextId ?? 'default'}
                  </span>
                </td>
              )}
              <td className="py-2 font-mono text-gray-200">{step.action.type}</td>
              <td className="py-2 text-gray-400 truncate max-w-xs">{step.metadata.url}</td>
              <td className="py-2 text-right text-gray-400">{step.duration}ms</td>
              <td className="py-2">
                {step.error && (
                  <span className="text-red-400 truncate block max-w-xs" title={step.error}>
                    {step.error.slice(0, 60)}
                  </span>
                )}
              </td>
              <td className="py-2 text-center">
                <ScreenshotViewer sessionId={sessionId} stepId={step.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
