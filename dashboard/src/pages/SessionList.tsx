import { Link } from 'react-router-dom';
import { useSessions } from '../hooks/useSessions';
import StatusBadge from '../components/StatusBadge';
import { SkeletonTable } from '../components/Skeleton';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export default function SessionList() {
  const { data: sessions, isLoading, error, refetch } = useSessions();

  if (isLoading) {
    return (
      <div>
        <h1 className="mb-4 text-xl font-bold">Sessions</h1>
        <SkeletonTable rows={5} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load sessions"
        message="Could not fetch session data from the server."
        onRetry={() => refetch()}
      />
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        }
        title="No sessions yet"
        description="Start a QA session to begin testing. Sessions will appear here with their results."
        action={{ label: 'Getting Started', to: '/guide' }}
      />
    );
  }

  return (
    <div className="animate-fadeIn">
      <h1 className="mb-4 text-xl font-bold">Sessions</h1>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm" role="table">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-400">
              <th scope="col" className="py-2 pr-4">
                ID
              </th>
              <th scope="col" className="py-2 pr-4">
                Status
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
              <th scope="col" className="py-2 text-right">
                Findings
              </th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                <td className="py-2 pr-4">
                  <Link
                    to={`/session/${s.id}`}
                    className="font-mono text-xs text-orange-400 hover:underline"
                  >
                    {s.id}
                  </Link>
                </td>
                <td className="py-2 pr-4">
                  <StatusBadge status={s.status} />
                </td>
                <td className="py-2 pr-4 text-xs text-gray-400">
                  {new Date(s.startTime).toLocaleString()}
                </td>
                <td className="py-2 pr-4 text-right text-xs text-gray-400">
                  {formatDuration(s.duration)}
                </td>
                <td className="py-2 pr-4 text-right">{s.stepCount}</td>
                <td className="py-2 pr-4 text-right">
                  {s.bugCount > 0 ? (
                    <span className="text-red-400">{s.bugCount}</span>
                  ) : (
                    <span className="text-gray-600">0</span>
                  )}
                </td>
                <td className="py-2 text-right">{s.findingCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {sessions.map((s) => (
          <Link
            key={s.id}
            to={`/session/${s.id}`}
            className="block rounded-lg border border-gray-800 bg-gray-900/50 p-4 transition-colors hover:border-gray-700"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs text-orange-400">{s.id}</span>
              <StatusBadge status={s.status} />
            </div>
            <div className="mb-2 text-xs text-gray-500">
              {new Date(s.startTime).toLocaleString()} — {formatDuration(s.duration)}
            </div>
            <div className="flex gap-4 text-xs">
              <span className="text-gray-400">{s.stepCount} steps</span>
              <span className={s.bugCount > 0 ? 'text-red-400' : 'text-gray-600'}>
                {s.bugCount} bugs
              </span>
              <span className="text-gray-400">{s.findingCount} findings</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
