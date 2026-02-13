const colors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  major: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  minor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  cosmetic: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

export default function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium border ${colors[severity] ?? 'bg-gray-700 text-gray-300 border-gray-600'}`}
    >
      {severity.toUpperCase()}
    </span>
  );
}
