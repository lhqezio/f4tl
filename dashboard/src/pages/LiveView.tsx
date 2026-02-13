import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchLiveSession } from '../lib/api';
import { useWebSocket, type WsMessage } from '../hooks/useWebSocket';
import StepTimeline from '../components/StepTimeline';
import BugCard from '../components/BugCard';

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
      // Invalidate live session data on relevant events
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

  const { connected } = useWebSocket((msg) => {
    setWsConnected(true);
    handleMessage(msg);
  });

  if (isLoading) {
    return <p className="text-gray-500 text-sm">Connecting to live session...</p>;
  }

  if (error || !data) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">No active session.</p>
        <p className="text-gray-600 text-sm mt-1">Start a QA session to see live updates here.</p>
      </div>
    );
  }

  const { session, bugs, summary } = data;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Live Session</h1>
          <span className="font-mono text-sm text-gray-500">{session.id}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}
          />
          <span className="text-xs text-gray-500">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <StatCard label="Steps" value={summary.stepCount} />
          <StatCard label="Duration" value={`${(summary.duration / 1000).toFixed(0)}s`} />
          <StatCard label="Bugs" value={summary.bugCount} highlight={summary.bugCount > 0} />
          <StatCard label="Findings" value={summary.findingCount} />
          <StatCard
            label="Errors"
            value={summary.errorStepCount}
            highlight={summary.errorStepCount > 0}
          />
        </div>
      )}

      {bugs.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-400 mb-2">Recent Bugs</h2>
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

      <h2 className="text-sm font-medium text-gray-400 mb-2">Step Timeline</h2>
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
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-red-400' : 'text-gray-100'}`}>{value}</p>
    </div>
  );
}
