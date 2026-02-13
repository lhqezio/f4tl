import { Link } from 'react-router-dom';
import { useSessions } from '../hooks/useSessions';
import StatusBadge from '../components/StatusBadge';

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export default function SessionList() {
  const { data: sessions, isLoading, error } = useSessions();

  if (isLoading) {
    return <p className="text-gray-500 text-sm">Loading sessions...</p>;
  }

  if (error) {
    return <p className="text-red-400 text-sm">Failed to load sessions.</p>;
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">No sessions yet.</p>
        <p className="text-gray-600 text-sm mt-1">
          Start a QA session with <code className="text-orange-400">f4tl serve</code>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Sessions</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800 text-left">
              <th className="py-2 pr-4">ID</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Started</th>
              <th className="py-2 pr-4 text-right">Duration</th>
              <th className="py-2 pr-4 text-right">Steps</th>
              <th className="py-2 pr-4 text-right">Bugs</th>
              <th className="py-2 text-right">Findings</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                <td className="py-2 pr-4">
                  <Link
                    to={`/session/${s.id}`}
                    className="text-orange-400 hover:underline font-mono text-xs"
                  >
                    {s.id}
                  </Link>
                </td>
                <td className="py-2 pr-4">
                  <StatusBadge status={s.status} />
                </td>
                <td className="py-2 pr-4 text-gray-400 text-xs">
                  {new Date(s.startTime).toLocaleString()}
                </td>
                <td className="py-2 pr-4 text-right text-gray-400 text-xs">
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
    </div>
  );
}
