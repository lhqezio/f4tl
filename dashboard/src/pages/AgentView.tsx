import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAgent, type AgentEvent } from '../hooks/useAgent';

const PRESETS = [
  {
    label: 'Smoke Test',
    prompt: 'Smoke test {url} — navigate key pages, check for console errors and broken links',
  },
  {
    label: 'Full QA',
    prompt: 'Thoroughly test {url} — test all forms, navigation, edge cases, and report bugs',
  },
  {
    label: 'Accessibility Audit',
    prompt:
      'Audit {url} for accessibility — check ARIA labels, contrast, keyboard navigation, screen reader compatibility',
  },
];

export default function AgentView() {
  const { status, config, events, startError, start, cancel, clearEvents, bottomRef } = useAgent();

  const isIdle = !status.running && events.length === 0;
  const isRunning = status.running;
  const isComplete = !status.running && events.length > 0;

  if (!config) {
    return <div className="text-sm text-gray-500">Loading agent configuration...</div>;
  }

  return (
    <div className="animate-fadeIn">
      <h1 className="mb-4 text-xl font-bold">Agent</h1>

      {!config.apiKeyConfigured && (
        <div className="mb-6 rounded-lg border border-yellow-600/30 bg-yellow-900/10 p-4">
          <p className="mb-1 text-sm font-medium text-yellow-400">API Key Required</p>
          <p className="text-xs text-gray-400">
            Set the{' '}
            <code className="rounded bg-gray-800 px-1.5 py-0.5 text-orange-400">
              ANTHROPIC_API_KEY
            </code>{' '}
            environment variable or add{' '}
            <code className="rounded bg-gray-800 px-1.5 py-0.5 text-orange-400">agent.apiKey</code>{' '}
            to your f4tl config.
          </p>
        </div>
      )}

      {(isIdle || isComplete) && (
        <StartForm
          config={config}
          onStart={start}
          startError={startError}
          disabled={!config.apiKeyConfigured}
          isComplete={isComplete}
          onClear={clearEvents}
        />
      )}

      {isRunning && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 animate-pulse rounded-full bg-orange-400" />
            <span className="text-sm text-gray-300">Running: {status.currentGoal}</span>
            <span className="text-xs text-gray-500">
              Turn {status.turnNumber}/{status.maxTurns}
            </span>
          </div>
          <button
            onClick={cancel}
            className="rounded-lg border border-red-700 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-900/20"
          >
            Cancel
          </button>
        </div>
      )}

      {isRunning && status.turnNumber !== undefined && status.maxTurns !== undefined && (
        <div className="mb-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
            <div
              className="h-full rounded-full bg-orange-400 transition-all"
              style={{ width: `${Math.min((status.turnNumber / status.maxTurns) * 100, 100)}%` }}
            />
          </div>
          <div className="mt-1 text-right text-xs text-gray-500">
            {Math.round((status.turnNumber / status.maxTurns) * 100)}%
          </div>
        </div>
      )}

      {events.length > 0 && <EventTimeline events={events} />}

      {isComplete && <CompleteSummary events={events} />}

      <div ref={bottomRef} />
    </div>
  );
}

function StartForm({
  config,
  onStart,
  startError,
  disabled,
  isComplete,
  onClear,
}: {
  config: NonNullable<ReturnType<typeof useAgent>['config']>;
  onStart: (goal: string, opts?: { model?: string; maxTurns?: number }) => Promise<void>;
  startError: string | null;
  disabled: boolean;
  isComplete: boolean;
  onClear: () => void;
}) {
  const [goal, setGoal] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [model, setModel] = useState(config.defaultModel);
  const [maxTurns, setMaxTurns] = useState(config.defaultMaxTurns);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;
    onStart(goal.trim(), { model, maxTurns });
  };

  const handlePreset = (prompt: string) => {
    setGoal(prompt);
  };

  return (
    <div className="mb-6">
      {isComplete && (
        <button
          onClick={onClear}
          className="mb-4 rounded-lg bg-orange-400 px-4 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-orange-300"
        >
          Run Again
        </button>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="goal" className="mb-1.5 block text-sm font-medium text-gray-300">
            Testing Goal
          </label>
          <textarea
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Smoke test https://myapp.com — check all pages and forms"
            className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3 text-sm text-gray-200 placeholder-gray-600 transition-colors focus:border-orange-400 focus:outline-none"
            rows={3}
            disabled={disabled}
          />
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePreset(preset.prompt)}
              disabled={disabled}
              className="rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200 disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Settings toggle */}
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="text-xs text-gray-500 transition-colors hover:text-gray-300"
        >
          {showSettings ? '▼ Hide settings' : '▶ Settings'}
        </button>

        {showSettings && (
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-gray-700/50 bg-gray-800/30 p-4">
            <div>
              <label htmlFor="model" className="mb-1 block text-xs text-gray-400">
                Model
              </label>
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200"
              >
                {config.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="maxTurns" className="mb-1 block text-xs text-gray-400">
                Max Turns: {maxTurns}
              </label>
              <input
                id="maxTurns"
                type="range"
                min={10}
                max={200}
                step={10}
                value={maxTurns}
                onChange={(e) => setMaxTurns(Number(e.target.value))}
                className="w-full accent-orange-400"
              />
            </div>
          </div>
        )}

        {startError && <p className="text-sm text-red-400">{startError}</p>}

        <button
          type="submit"
          disabled={disabled || !goal.trim()}
          className="rounded-lg bg-orange-400 px-6 py-2.5 text-sm font-medium text-gray-950 transition-colors hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Start Agent
        </button>
      </form>
    </div>
  );
}

function EventTimeline({ events }: { events: AgentEvent[] }) {
  return (
    <div className="space-y-2">
      <h2 className="mb-2 text-sm font-medium text-gray-400">Timeline</h2>
      {events.map((event, i) => (
        <TimelineItem key={i} event={event} />
      ))}
    </div>
  );
}

function TimelineItem({ event }: { event: AgentEvent }) {
  const [expanded, setExpanded] = useState(false);

  if (event.type === 'agent:thinking') {
    const text = event.data.text as string;
    return (
      <div className="rounded border border-gray-800 bg-gray-900/50 p-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-2 text-left text-xs text-gray-500"
        >
          <span>{expanded ? '▼' : '▶'}</span>
          <span>Thinking (turn {event.data.turnNumber as number})</span>
        </button>
        {expanded && (
          <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-xs text-gray-400">
            {text}
          </pre>
        )}
      </div>
    );
  }

  if (event.type === 'agent:tool_call') {
    const name = event.data.name as string;
    const input = event.data.input as Record<string, unknown>;
    return (
      <div className="rounded border border-gray-800 bg-gray-900/50 p-3">
        <div className="flex items-center gap-2">
          <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs font-mono text-blue-400">
            {name}
          </span>
          <span className="text-xs text-gray-600">Turn {event.data.turnNumber as number}</span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs text-gray-600 hover:text-gray-400"
        >
          {expanded ? '▼ Hide params' : '▶ Show params'}
        </button>
        {expanded && (
          <pre className="mt-2 max-h-40 overflow-auto text-xs text-gray-500">
            {JSON.stringify(input, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (event.type === 'agent:tool_result') {
    const isError = event.data.isError as boolean;
    return (
      <div className="flex items-center gap-2 px-3 py-1">
        <span className={`h-1.5 w-1.5 rounded-full ${isError ? 'bg-red-400' : 'bg-green-400'}`} />
        <span className="text-xs text-gray-500">
          {event.data.name as string} {isError ? 'failed' : 'completed'}
        </span>
      </div>
    );
  }

  if (event.type === 'agent:turn') {
    return (
      <div className="flex items-center gap-2 px-3 py-1">
        <span className="text-xs text-gray-600">
          Turn {event.data.turnNumber as number}/{event.data.maxTurns as number}
        </span>
      </div>
    );
  }

  if (event.type === 'agent:error') {
    return (
      <div className="rounded border border-red-800/50 bg-red-900/10 p-3">
        <p className="text-sm text-red-400">{event.data.error as string}</p>
      </div>
    );
  }

  if (event.type === 'agent:cancelled') {
    return (
      <div className="rounded border border-yellow-800/50 bg-yellow-900/10 p-3">
        <p className="text-sm text-yellow-400">
          Agent cancelled at turn {event.data.turnNumber as number}
        </p>
      </div>
    );
  }

  if (event.type === 'agent:complete') {
    return (
      <div className="rounded border border-green-800/50 bg-green-900/10 p-3">
        <p className="text-sm text-green-400">
          Completed: {event.data.turns as number} turns in{' '}
          {((event.data.duration as number) / 1000).toFixed(1)}s
        </p>
      </div>
    );
  }

  return null;
}

function CompleteSummary({ events }: { events: AgentEvent[] }) {
  const completeEvent = events.find((e) => e.type === 'agent:complete');
  const toolCalls = events.filter((e) => e.type === 'agent:tool_call');
  const errors = events.filter(
    (e) => e.type === 'agent:tool_result' && (e.data.isError as boolean),
  );

  if (!completeEvent) return null;

  return (
    <div className="mt-6 rounded-lg border border-gray-800 bg-gray-900/50 p-4">
      <h3 className="mb-3 text-sm font-medium text-gray-300">Run Summary</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-xs text-gray-500">Turns</p>
          <p className="text-lg font-bold text-gray-100">{completeEvent.data.turns as number}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Duration</p>
          <p className="text-lg font-bold text-gray-100">
            {((completeEvent.data.duration as number) / 1000).toFixed(1)}s
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Tool Calls</p>
          <p className="text-lg font-bold text-gray-100">{toolCalls.length}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Errors</p>
          <p
            className={`text-lg font-bold ${errors.length > 0 ? 'text-red-400' : 'text-gray-100'}`}
          >
            {errors.length}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <Link to="/" className="text-sm text-orange-400 hover:underline">
          View session details →
        </Link>
      </div>
    </div>
  );
}
