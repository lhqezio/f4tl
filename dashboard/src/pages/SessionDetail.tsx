import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import StepTimeline from '../components/StepTimeline';
import BugCard from '../components/BugCard';
import FindingCard from '../components/FindingCard';
import Breadcrumbs from '../components/Breadcrumbs';
import Tooltip from '../components/Tooltip';
import { SkeletonCard } from '../components/Skeleton';
import ErrorState from '../components/ErrorState';
import { GLOSSARY } from '../components/Glossary';

type Tab = 'timeline' | 'bugs' | 'findings';

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: session, isLoading, error, refetch } = useSession(id);
  const [tab, setTab] = useState<Tab>('timeline');
  const tabRefs = useRef<Map<Tab, HTMLButtonElement>>(new Map());

  // Arrow key navigation for tabs
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'timeline', label: 'Timeline', count: session?.steps.length },
    { key: 'bugs', label: 'Bugs', count: session?.bugs?.length ?? 0 },
    { key: 'findings', label: 'Findings', count: session?.findings?.length ?? 0 },
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

  // Focus first tab on mount
  useEffect(() => {
    tabRefs.current.get(tab)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div>
        <Breadcrumbs items={[{ label: 'Sessions', to: '/' }, { label: id ?? '...' }]} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div>
        <Breadcrumbs items={[{ label: 'Sessions', to: '/' }, { label: id ?? 'Unknown' }]} />
        <ErrorState
          title="Session not found"
          message="This session may have been deleted or the ID is invalid."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <Breadcrumbs items={[{ label: 'Sessions', to: '/' }, { label: session.id }]} />

      <h1 className="mb-4 font-mono text-xl font-bold">{session.id}</h1>

      {session.summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Steps" value={session.summary.stepCount} />
          <Stat label="Duration" value={`${(session.summary.duration / 1000).toFixed(1)}s`} />
          <Stat
            label="Bugs"
            value={session.summary.bugCount}
            highlight={session.summary.bugCount > 0}
          />
          <Stat label="Findings" value={session.summary.findingCount} />
          {session.summary.contexts && session.summary.contexts.length > 1 && (
            <Stat
              label={
                <Tooltip content={GLOSSARY.actors}>
                  <span className="cursor-help border-b border-dashed border-gray-600">Actors</span>
                </Tooltip>
              }
              value={session.summary.contexts.length}
            />
          )}
        </div>
      )}

      <div className="mb-4 border-b border-gray-800" role="tablist" aria-label="Session details">
        <div className="flex gap-1">
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
      </div>

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'timeline' && <StepTimeline steps={session.steps} sessionId={session.id} />}

        {tab === 'bugs' && (
          <div className="space-y-3">
            {(session.bugs ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">No bugs recorded.</p>
            ) : (
              session.bugs?.map((b) => <BugCard key={b.id} bug={b} />)
            )}
          </div>
        )}

        {tab === 'findings' && (
          <div className="space-y-3">
            {(session.findings ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">No findings recorded.</p>
            ) : (
              session.findings?.map((f) => <FindingCard key={f.id} finding={f} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: React.ReactNode;
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
