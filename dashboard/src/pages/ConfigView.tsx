import { useState } from 'react';
import { useConfig } from '../hooks/useConfig';

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
  const { data, isLoading, error } = useConfig();

  if (isLoading) {
    return <div className="text-gray-400">Loading config...</div>;
  }

  if (error || !data) {
    return (
      <div className="text-red-400">
        Failed to load config. Make sure the server was started with config available.
      </div>
    );
  }

  const { config, features, detectedFramework } = data;

  return (
    <div className="space-y-6">
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
      >
        <span className="text-sm font-medium text-gray-200">{label}</span>
        <span className="text-xs text-gray-500">{open ? '▼' : '▶'}</span>
      </button>
      {open && (
        <div className="border-t border-gray-700/50 px-4 py-3">
          <pre className="max-h-96 overflow-auto text-xs text-gray-400">
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
