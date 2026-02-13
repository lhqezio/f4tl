import type { Bug } from '../lib/api';
import SeverityBadge from './SeverityBadge';

export default function BugCard({ bug }: { bug: Bug }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-sm">{bug.title}</h3>
        <SeverityBadge severity={bug.severity} />
      </div>

      {bug.url && <p className="text-xs text-gray-500 truncate">{bug.url}</p>}

      <div>
        <p className="text-xs text-gray-400 mb-1 font-medium">Steps to Reproduce</p>
        <ol className="text-xs text-gray-300 list-decimal list-inside space-y-0.5">
          {bug.stepsToReproduce.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-400 mb-0.5 font-medium">Expected</p>
          <p className="text-xs text-gray-300">{bug.expected}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5 font-medium">Actual</p>
          <p className="text-xs text-gray-300">{bug.actual}</p>
        </div>
      </div>

      {bug.rootCause && (
        <div>
          <p className="text-xs text-gray-400 mb-0.5 font-medium">Root Cause</p>
          <p className="text-xs text-gray-300">{bug.rootCause}</p>
        </div>
      )}
    </div>
  );
}
