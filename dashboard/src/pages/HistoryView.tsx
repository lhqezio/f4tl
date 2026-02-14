import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useHistory, useBugLedger } from '../hooks/useHistory';
import Tooltip from '../components/Tooltip';
import { GLOSSARY } from '../components/Glossary';
import { SkeletonTable } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

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

type TabKey = 'sessions' | 'bugs';

export default function HistoryView() {
  const [tab, setTab] = useState<TabKey>('sessions');
  const { data: history, isLoading: historyLoading } = useHistory();
  const { data: bugs, isLoading: bugsLoading } = useBugLedger();

  const tabRefs = useRef<Map<TabKey, HTMLButtonElement>>(new Map());
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'sessions', label: 'Sessions' },
    { key: 'bugs', label: 'Bug Ledger' },
  ];

  const handleTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    else return;
    e.preventDefault();
    const nextTab = tabs[next].key;
    setTab(nextTab);
    tabRefs.current.get(nextTab)?.focus();
  };

  return (
    <div className="animate-fadeIn">
      <h1 className="mb-4 text-xl font-bold">History</h1>

      <div className="mb-6 border-b border-gray-800" role="tablist" aria-label="History tabs">
        <div className="flex gap-4">
          {tabs.map((t, i) => (
            <button
              key={t.key}
              ref={(el) => {
                if (el) tabRefs.current.set(t.key, el);
              }}
              role="tab"
              aria-selected={tab === t.key}
              aria-controls={`panel-${t.key}`}
              tabIndex={tab === t.key ? 0 : -1}
              onClick={() => setTab(t.key)}
              onKeyDown={(e) => handleTabKeyDown(e, i)}
              className={`pb-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'border-b-2 border-orange-400 text-orange-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div id={`panel-${tab}`} role="tabpanel">
        {tab === 'sessions' && <SessionsTab history={history} isLoading={historyLoading} />}
        {tab === 'bugs' && <BugsTab bugs={bugs} isLoading={bugsLoading} />}
      </div>
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
  if (isLoading) return <SkeletonTable rows={5} />;
  if (!history || history.length === 0) {
    return (
      <EmptyState
        title="No session history"
        description="Completed sessions will appear here with their results and trends."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="border-b border-gray-800 text-left text-gray-400">
            <th scope="col" className="py-2 pr-4">
              Session
            </th>
            <th scope="col" className="py-2 pr-4">
              Started
            </th>
            <th scope="col" className="py-2 pr-4 text-right">
              Duration
            </th>
            <th scope="col" className="py-2 pr-4 text-right">
              Steps
            </th>
            <th scope="col" className="py-2 pr-4 text-right">
              Bugs
            </th>
            <th scope="col" className="py-2 pr-4 text-right">
              Errors
            </th>
            <th scope="col" className="py-2 text-right">
              URLs
            </th>
          </tr>
        </thead>
        <tbody>
          {history.map((entry) => (
            <tr key={entry.sessionId} className="border-b border-gray-800/50 hover:bg-gray-900/50">
              <td className="py-2 pr-4">
                <Link
                  to={`/session/${entry.sessionId}`}
                  className="font-mono text-xs text-orange-400 hover:underline"
                >
                  {entry.sessionId}
                </Link>
              </td>
              <td className="py-2 pr-4 text-xs text-gray-400">
                {new Date(entry.startTime).toLocaleString()}
              </td>
              <td className="py-2 pr-4 text-right text-xs text-gray-400">
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
  if (isLoading) return <SkeletonTable rows={5} />;
  if (!bugs || bugs.length === 0) {
    return (
      <EmptyState
        title="No bugs found"
        description="Bugs discovered across all sessions will be tracked here with their severity and recurrence."
      />
    );
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
          <h3 className="mb-2 text-sm font-semibold text-gray-300">Recurring Bugs</h3>
          <div className="space-y-1">
            {recurring.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="rounded bg-red-900/30 px-2 py-0.5 font-mono text-xs text-red-400">
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
        <table className="w-full text-sm" role="table">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-400">
              <th scope="col" className="py-2 pr-4">
                Bug
              </th>
              <th scope="col" className="py-2 pr-4">
                Severity
              </th>
              <th scope="col" className="py-2 pr-4">
                Session
              </th>
              <th scope="col" className="py-2 pr-4">
                URL
              </th>
              <th scope="col" className="py-2 pr-4">
                <Tooltip content={GLOSSARY.fingerprint}>
                  <span className="cursor-help border-b border-dashed border-gray-600">
                    Fingerprint
                  </span>
                </Tooltip>
              </th>
              <th scope="col" className="py-2 text-right">
                Time
              </th>
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
                  <Tooltip content={GLOSSARY.severity}>
                    <span className={`cursor-help ${severityColor[bug.severity]}`}>
                      {bug.severity}
                    </span>
                  </Tooltip>
                </td>
                <td className="py-2 pr-4">
                  <Link
                    to={`/session/${bug.sessionId}`}
                    className="font-mono text-xs text-orange-400 hover:underline"
                  >
                    {bug.sessionId.slice(0, 8)}
                  </Link>
                </td>
                <td className="py-2 pr-4 max-w-48 truncate text-xs text-gray-500">
                  {bug.url ?? '—'}
                </td>
                <td className="py-2 pr-4 font-mono text-xs text-gray-500">
                  {bug.fingerprint.slice(0, 12)}
                </td>
                <td className="py-2 text-right text-xs text-gray-400">
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
