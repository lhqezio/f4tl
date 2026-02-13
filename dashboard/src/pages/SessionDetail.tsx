import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import StepTimeline from '../components/StepTimeline';
import BugCard from '../components/BugCard';
import FindingCard from '../components/FindingCard';

type Tab = 'timeline' | 'bugs' | 'findings';

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: session, isLoading, error } = useSession(id);
  const [tab, setTab] = useState<Tab>('timeline');

  if (isLoading) return <p className="text-gray-500 text-sm">Loading...</p>;
  if (error || !session) return <p className="text-red-400 text-sm">Session not found.</p>;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'timeline', label: 'Timeline', count: session.steps.length },
    { key: 'bugs', label: 'Bugs', count: session.bugs?.length ?? 0 },
    { key: 'findings', label: 'Findings', count: session.findings?.length ?? 0 },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link to="/" className="text-gray-500 hover:text-gray-300 text-sm">
          &larr; Sessions
        </Link>
        <h1 className="text-xl font-bold font-mono">{session.id}</h1>
      </div>

      {session.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Stat label="Steps" value={session.summary.stepCount} />
          <Stat label="Duration" value={`${(session.summary.duration / 1000).toFixed(1)}s`} />
          <Stat
            label="Bugs"
            value={session.summary.bugCount}
            highlight={session.summary.bugCount > 0}
          />
          <Stat label="Findings" value={session.summary.findingCount} />
        </div>
      )}

      <div className="flex gap-1 mb-4 border-b border-gray-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-orange-400 text-orange-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 text-xs text-gray-600">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'timeline' && <StepTimeline steps={session.steps} sessionId={session.id} />}

      {tab === 'bugs' && (
        <div className="space-y-3">
          {(session.bugs ?? []).length === 0 ? (
            <p className="text-gray-500 text-sm">No bugs recorded.</p>
          ) : (
            session.bugs?.map((b) => <BugCard key={b.id} bug={b} />)
          )}
        </div>
      )}

      {tab === 'findings' && (
        <div className="space-y-3">
          {(session.findings ?? []).length === 0 ? (
            <p className="text-gray-500 text-sm">No findings recorded.</p>
          ) : (
            session.findings?.map((f) => <FindingCard key={f.id} finding={f} />)
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
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
