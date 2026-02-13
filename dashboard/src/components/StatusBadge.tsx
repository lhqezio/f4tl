export default function StatusBadge({ status }: { status: 'active' | 'completed' }) {
  const styles =
    status === 'active'
      ? 'bg-green-500/20 text-green-400 border-green-500/30'
      : 'bg-gray-700/40 text-gray-400 border-gray-600/30';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${styles}`}
    >
      {status === 'active' && (
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      )}
      {status}
    </span>
  );
}
