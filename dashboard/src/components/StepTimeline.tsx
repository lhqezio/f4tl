import { useState, useMemo } from 'react';
import type { SessionStep } from '../lib/api';
import ScreenshotViewer from './ScreenshotViewer';
import Tooltip from './Tooltip';
import { GLOSSARY } from './Glossary';

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
        <div className="mb-2 flex flex-wrap gap-1.5">
          {contextNames.map((name) => (
            <button
              key={name}
              onClick={() => toggleContext(name)}
              aria-pressed={effectiveFilter.has(name)}
              className={`rounded border px-2 py-0.5 font-mono text-xs transition-opacity ${contextColorClass(name)} ${
                effectiveFilter.has(name) ? 'opacity-100' : 'opacity-30'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs" role="table">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th scope="col" className="w-10 py-2 text-left">
                #
              </th>
              {hasContexts && (
                <th scope="col" className="w-24 py-2 text-left">
                  <Tooltip content={GLOSSARY.context}>
                    <span className="cursor-help border-b border-dashed border-gray-600">
                      Context
                    </span>
                  </Tooltip>
                </th>
              )}
              <th scope="col" className="py-2 text-left">
                Action
              </th>
              <th scope="col" className="py-2 text-left">
                URL
              </th>
              <th scope="col" className="w-20 py-2 text-right">
                Duration
              </th>
              <th scope="col" className="w-32 py-2 text-left">
                Error
              </th>
              <th scope="col" className="w-16 py-2 text-center">
                Screenshot
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredSteps.map((step, i) => (
              <tr key={step.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                <td className="py-2 text-gray-500">{i + 1}</td>
                {hasContexts && (
                  <td className="py-2">
                    <span
                      className={`rounded border px-1.5 py-0.5 font-mono text-xs ${contextColorClass(step.contextId ?? 'default')}`}
                    >
                      {step.contextId ?? 'default'}
                    </span>
                  </td>
                )}
                <td className="py-2 font-mono text-gray-200">{step.action.type}</td>
                <td className="py-2 max-w-xs truncate text-gray-400">
                  {step.metadata.url && step.metadata.url.length > 50 ? (
                    <Tooltip content={step.metadata.url}>
                      <span className="cursor-help">{step.metadata.url}</span>
                    </Tooltip>
                  ) : (
                    step.metadata.url
                  )}
                </td>
                <td className="py-2 text-right text-gray-400">{step.duration}ms</td>
                <td className="py-2">
                  {step.error && (
                    <Tooltip content={step.error}>
                      <span className="block max-w-xs cursor-help truncate text-red-400">
                        {step.error.slice(0, 60)}
                      </span>
                    </Tooltip>
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
    </div>
  );
}
