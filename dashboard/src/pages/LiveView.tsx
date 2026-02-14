import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchLiveSession } from '../lib/api';
import { useWebSocket, type WsMessage } from '../hooks/useWebSocket';
import StepTimeline from '../components/StepTimeline';
import BugCard from '../components/BugCard';
import { SkeletonCard } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

export default function LiveView() {
  const queryClient = useQueryClient();
  const [, setWsConnected] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['live-session'],
    queryFn: fetchLiveSession,
    refetchInterval: 5000,
  });

  const handleMessage = useCallback(
    (msg: WsMessage) => {
      if (
        msg.type === 'step:recorded' ||
        msg.type === 'bug:created' ||
        msg.type === 'finding:created'
      ) {
        queryClient.invalidateQueries({ queryKey: ['live-session'] });
      }
    },
    [queryClient],
  );

  const { connected, reconnecting, reconnectAttempt } = useWebSocket((msg) => {
    setWsConnected(true);
    handleMessage(msg);
  });

  if (isLoading) {
    return (
      <div>
        <h1 className="mb-4 text-xl font-bold">Live Session</h1>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={
          <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        }
        title="No active session"
        description="Start a QA session with your MCP client or run 'f4tl serve' to begin. Live updates will appear here automatically."
        action={{ label: 'Getting Started', to: '/guide' }}
      />
    );
  }

  const { session, bugs, summary } = data;

  return (
    <div className="animate-fadeIn">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Live Session</h1>
          <span className="font-mono text-sm text-gray-500">{session.id}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-green-400' : 'bg-red-400'}`}
          />
          <span className="text-xs text-gray-500">
            {connected
              ? 'Connected'
              : reconnecting
                ? `Reconnecting (${reconnectAttempt})...`
                : 'Disconnected'}
          </span>
        </div>
      </div>

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="Steps" value={summary.stepCount} />
          <StatCard label="Duration" value={`${(summary.duration / 1000).toFixed(0)}s`} />
          <StatCard label="Bugs" value={summary.bugCount} highlight={summary.bugCount > 0} />
          <StatCard label="Findings" value={summary.findingCount} />
          <StatCard
            label="Errors"
            value={summary.errorStepCount}
            highlight={summary.errorStepCount > 0}
          />
          {summary.contexts && summary.contexts.length > 1 && (
            <StatCard label="Actors" value={summary.contexts.length} />
          )}
        </div>
      )}

      {bugs.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-gray-400">Recent Bugs</h2>
          <div className="space-y-2">
            {bugs
              .slice(-3)
              .reverse()
              .map((b) => (
                <BugCard key={b.id} bug={b} />
              ))}
          </div>
        </div>
      )}

      <h2 className="mb-2 text-sm font-medium text-gray-400">Step Timeline</h2>
      <StepTimeline steps={session.steps} sessionId={session.id} />
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-3">
      <p className="mb-0.5 text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-red-400' : 'text-gray-100'}`}>{value}</p>
    </div>
  );
}
