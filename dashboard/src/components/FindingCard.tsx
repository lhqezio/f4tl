import type { Finding } from '../lib/api';

const categoryColors: Record<string, string> = {
  usability: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  performance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  accessibility: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  security: 'bg-red-500/20 text-red-400 border-red-500/30',
  suggestion: 'bg-green-500/20 text-green-400 border-green-500/30',
  observation: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export default function FindingCard({ finding }: { finding: Finding }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-sm">{finding.title}</h3>
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium border ${categoryColors[finding.category] ?? 'bg-gray-700 text-gray-300 border-gray-600'}`}
        >
          {finding.category.toUpperCase()}
        </span>
      </div>
      <p className="text-xs text-gray-300 whitespace-pre-wrap">{finding.description}</p>
      {finding.url && <p className="text-xs text-gray-500 truncate">{finding.url}</p>}
    </div>
  );
}
