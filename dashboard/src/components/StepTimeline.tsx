import type { SessionStep } from '../lib/api';
import ScreenshotViewer from './ScreenshotViewer';

interface Props {
  steps: SessionStep[];
  sessionId: string;
}

export default function StepTimeline({ steps, sessionId }: Props) {
  if (steps.length === 0) {
    return <p className="text-sm text-gray-500">No steps recorded yet.</p>;
  }

  return (
    <div className="space-y-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400 border-b border-gray-800">
            <th className="py-2 text-left w-10">#</th>
            <th className="py-2 text-left">Action</th>
            <th className="py-2 text-left">URL</th>
            <th className="py-2 text-right w-20">Duration</th>
            <th className="py-2 text-left w-32">Error</th>
            <th className="py-2 text-center w-16">Screenshot</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step, i) => (
            <tr key={step.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
              <td className="py-2 text-gray-500">{i + 1}</td>
              <td className="py-2 font-mono text-gray-200">{step.action.type}</td>
              <td className="py-2 text-gray-400 truncate max-w-xs">{step.metadata.url}</td>
              <td className="py-2 text-right text-gray-400">{step.duration}ms</td>
              <td className="py-2">
                {step.error && (
                  <span className="text-red-400 truncate block max-w-xs" title={step.error}>
                    {step.error.slice(0, 60)}
                  </span>
                )}
              </td>
              <td className="py-2 text-center">
                <ScreenshotViewer sessionId={sessionId} stepId={step.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
