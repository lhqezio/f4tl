import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useHistory, useBugLedger } from '../hooks/useHistory';

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

const severityColor: Record<string, string> = {
  critical: 'text-red-400',
  major: 'text-orange-400',
  minor: 'text-yellow-400',
  cosmetic: 'text-gray-400',
};

export default function HistoryView() {
  const [tab, setTab] = useState<'sessions' | 'bugs'>('sessions');
  const { data: history, isLoading: historyLoading } = useHistory();
  const { data: bugs, isLoading: bugsLoading } = useBugLedger();

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">History</h1>

      <div className="flex gap-4 mb-6 border-b border-gray-800">
        <button
          onClick={() => setTab('sessions')}
          className={`pb-2 text-sm font-medium transition-colors ${
            tab === 'sessions'
              ? 'text-orange-400 border-b-2 border-orange-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Sessions
        </button>
        <button
          onClick={() => setTab('bugs')}
          className={`pb-2 text-sm font-medium transition-colors ${
            tab === 'bugs'
              ? 'text-orange-400 border-b-2 border-orange-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Bug Ledger
        </button>
      </div>

      {tab === 'sessions' && <SessionsTab history={history} isLoading={historyLoading} />}
      {tab === 'bugs' && <BugsTab bugs={bugs} isLoading={bugsLoading} />}
    </div>
  );
}

function SessionsTab({
  history,
  isLoading,
}: {
  history: ReturnType<typeof useHistory>['data'];
  isLoading: boolean;
}) {
  if (isLoading) return <p className="text-gray-500 text-sm">Loading history...</p>;
  if (!history || history.length === 0) {
    return <p className="text-gray-500 text-sm">No session history found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 border-b border-gray-800 text-left">
            <th className="py-2 pr-4">Session</th>
            <th className="py-2 pr-4">Started</th>
            <th className="py-2 pr-4 text-right">Duration</th>
            <th className="py-2 pr-4 text-right">Steps</th>
            <th className="py-2 pr-4 text-right">Bugs</th>
            <th className="py-2 pr-4 text-right">Errors</th>
            <th className="py-2 text-right">URLs</th>
          </tr>
        </thead>
        <tbody>
          {history.map((entry) => (
            <tr key={entry.sessionId} className="border-b border-gray-800/50 hover:bg-gray-900/50">
              <td className="py-2 pr-4">
                <Link
                  to={`/session/${entry.sessionId}`}
                  className="text-orange-400 hover:underline font-mono text-xs"
                >
                  {entry.sessionId}
                </Link>
              </td>
              <td className="py-2 pr-4 text-gray-400 text-xs">
                {new Date(entry.startTime).toLocaleString()}
              </td>
              <td className="py-2 pr-4 text-right text-gray-400 text-xs">
                {formatDuration(entry.duration)}
              </td>
              <td className="py-2 pr-4 text-right">{entry.stepCount}</td>
              <td className="py-2 pr-4 text-right">
                {entry.bugCount > 0 ? (
                  <span className="text-red-400">{entry.bugCount}</span>
                ) : (
                  <span className="text-gray-600">0</span>
                )}
              </td>
              <td className="py-2 pr-4 text-right">
                {entry.errorCount > 0 ? (
                  <span className="text-yellow-400">{entry.errorCount}</span>
                ) : (
                  <span className="text-gray-600">0</span>
                )}
              </td>
              <td className="py-2 text-right text-gray-400">{entry.urlsCovered.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BugsTab({
  bugs,
  isLoading,
}: {
  bugs: ReturnType<typeof useBugLedger>['data'];
  isLoading: boolean;
}) {
  if (isLoading) return <p className="text-gray-500 text-sm">Loading bug ledger...</p>;
  if (!bugs || bugs.length === 0) {
    return <p className="text-gray-500 text-sm">No bugs found across sessions.</p>;
  }

  // Group by fingerprint to show recurrence
  const grouped = new Map<string, { count: number; title: string; severity: string }>();
  for (const bug of bugs) {
    const existing = grouped.get(bug.fingerprint);
    if (existing) {
      existing.count++;
    } else {
      grouped.set(bug.fingerprint, { count: 1, title: bug.title, severity: bug.severity });
    }
  }
  const recurring = [...grouped.values()]
    .filter((g) => g.count > 1)
    .sort((a, b) => b.count - a.count);

  return (
    <div>
      {recurring.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Recurring Bugs</h3>
          <div className="space-y-1">
            {recurring.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="bg-red-900/30 text-red-400 px-2 py-0.5 rounded text-xs font-mono">
                  {r.count}x
                </span>
                <span className={severityColor[r.severity]}>{r.severity}</span>
                <span className="text-gray-300">{r.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800 text-left">
              <th className="py-2 pr-4">Bug</th>
              <th className="py-2 pr-4">Severity</th>
              <th className="py-2 pr-4">Session</th>
              <th className="py-2 pr-4">URL</th>
              <th className="py-2 text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {bugs.map((bug) => (
              <tr
                key={`${bug.bugId}-${bug.sessionId}`}
                className="border-b border-gray-800/50 hover:bg-gray-900/50"
              >
                <td className="py-2 pr-4 text-gray-300">{bug.title}</td>
                <td className="py-2 pr-4">
                  <span className={severityColor[bug.severity]}>{bug.severity}</span>
                </td>
                <td className="py-2 pr-4">
                  <Link
                    to={`/session/${bug.sessionId}`}
                    className="text-orange-400 hover:underline font-mono text-xs"
                  >
                    {bug.sessionId.slice(0, 8)}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-gray-500 text-xs max-w-48 truncate">
                  {bug.url ?? '—'}
                </td>
                <td className="py-2 text-right text-gray-400 text-xs">
                  {new Date(bug.timestamp).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
