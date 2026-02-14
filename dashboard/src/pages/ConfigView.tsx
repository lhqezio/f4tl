import { useState } from 'react';
import { useConfig } from '../hooks/useConfig';
import { SkeletonCard } from '../components/Skeleton';
import ErrorState from '../components/ErrorState';

const featureLabels: Record<string, string> = {
  auth: 'Auth',
  logs: 'Logs',
  database: 'Database',
  webhooks: 'Webhooks',
  journeys: 'Journeys',
  appProfile: 'App Profile',
  learning: 'Learning',
};

export default function ConfigView() {
  const { data, isLoading, error, refetch } = useConfig();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-gray-100">Configuration</h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Failed to load config"
        message="Make sure the server was started with config available."
        onRetry={() => refetch()}
      />
    );
  }

  const { config, features, detectedFramework } = data;

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-100">Configuration</h1>
        {detectedFramework && (
          <span className="rounded bg-orange-500/20 px-2 py-0.5 text-sm font-medium text-orange-300">
            {detectedFramework}
          </span>
        )}
      </div>

      {/* Feature flags grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Object.entries(featureLabels).map(([key, label]) => {
          const enabled = features[key as keyof typeof features];
          return (
            <div
              key={key}
              className={`rounded-lg border px-4 py-3 ${
                enabled
                  ? 'border-green-700/50 bg-green-900/20'
                  : 'border-gray-700/50 bg-gray-800/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    enabled ? 'bg-green-400' : 'bg-gray-600'
                  }`}
                />
                <span
                  className={`text-sm font-medium ${enabled ? 'text-green-300' : 'text-gray-500'}`}
                >
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Collapsible config sections */}
      <div className="space-y-2">
        {Object.entries(config).map(([key, value]) => (
          <ConfigSection key={key} label={key} value={value} />
        ))}
      </div>
    </div>
  );
}

function ConfigSection({ label, value }: { label: string; value: unknown }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-gray-700/50 bg-gray-800/30">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-gray-200">{label}</span>
        <svg
          className={`h-4 w-4 text-gray-500 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <div className={`overflow-hidden transition-all ${open ? 'max-h-96' : 'max-h-0'}`}>
        <div className="border-t border-gray-700/50 px-4 py-3">
          <pre className="max-h-80 overflow-auto text-xs text-gray-400">
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
