import { useConfig } from '../hooks/useConfig';

const toolCategories = [
  { name: 'Browser', count: 15 },
  { name: 'Network', count: 4 },
  { name: 'Code', count: 4 },
  { name: 'Context', count: '2-3' },
  { name: 'Report', count: 4 },
  { name: 'Logs', count: '3*' },
  { name: 'Database', count: '3*' },
  { name: 'Webhook', count: '2*' },
  { name: 'Learning', count: 3 },
  { name: 'Journey', count: '3*' },
  { name: 'Auth', count: '1*' },
  { name: 'Framework', count: 1 },
  { name: 'App Profile', count: '1*' },
  { name: 'Suppression', count: 1 },
  { name: 'Config Gen', count: 1 },
];

const featureDetails: Record<string, (cfg: Record<string, unknown>) => string> = {
  auth: (cfg) => {
    const auth = cfg.auth as Record<string, unknown> | undefined;
    if (!auth) return 'Not configured';
    const roles = Object.keys(auth);
    return `${roles.length} role${roles.length !== 1 ? 's' : ''}: ${roles.join(', ')}`;
  },
  logs: (cfg) => {
    const logs = cfg.logs as Record<string, unknown> | undefined;
    if (!logs) return 'Not configured';
    const sources = Object.keys(logs);
    return `${sources.length} source${sources.length !== 1 ? 's' : ''}: ${sources.join(', ')}`;
  },
  database: (cfg) => {
    const db = cfg.database as Record<string, unknown> | undefined;
    if (!db) return 'Not configured';
    return `${db.type ?? 'unknown'} connected`;
  },
  webhooks: (cfg) => {
    const wh = cfg.webhooks as Record<string, unknown> | undefined;
    if (!wh) return 'Not configured';
    return `Base URL: ${wh.baseUrl ?? 'not set'}`;
  },
  journeys: (cfg) => {
    const j = cfg.journeys as Record<string, unknown> | undefined;
    if (!j) return 'Not configured';
    return `${Object.keys(j).length} journey${Object.keys(j).length !== 1 ? 's' : ''} defined`;
  },
  appProfile: (cfg) => {
    const app = cfg.app as Record<string, unknown> | undefined;
    if (!app) return 'Not configured';
    const pages = app.pages as unknown[] | undefined;
    return `${app.name ?? 'unnamed'}${pages ? ` — ${pages.length} pages` : ''}`;
  },
  learning: (cfg) => {
    const l = cfg.learning as Record<string, unknown> | undefined;
    if (!l || l.enabled === false) return 'Disabled';
    return 'Enabled';
  },
};

const featureLabels: Record<string, string> = {
  auth: 'Auth',
  logs: 'Logs',
  database: 'Database',
  webhooks: 'Webhooks',
  journeys: 'Journeys',
  appProfile: 'App Profile',
  learning: 'Learning',
};

export default function GettingStarted() {
  const { data } = useConfig();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-xl font-bold text-gray-100">Getting Started</h1>

      {/* Setup Steps */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-200">Setup</h2>
        <div className="space-y-3">
          <Step n={1} title="Install f4tl" code="npm install -g f4tl" />
          <Step n={2} title="Generate config" code="cd your-project && f4tl init" />
          <Step
            n={3}
            title="Connect MCP client"
            code={`// claude_desktop_config.json
{
  "mcpServers": {
    "f4tl": {
      "command": "f4tl",
      "args": ["serve"],
      "cwd": "/path/to/your/project"
    }
  }
}`}
          />
        </div>
      </section>

      {/* Config Health */}
      {data && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-200">Config Health</h2>
          {data.detectedFramework && (
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
              Framework detected:{' '}
              <span className="font-medium text-blue-300">{data.detectedFramework}</span>
            </div>
          )}
          <div className="space-y-1.5">
            {Object.entries(featureLabels).map(([key, label]) => {
              const enabled = data.features[key as keyof typeof data.features];
              const detail = featureDetails[key]?.(data.config) ?? '';
              return (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      enabled ? 'bg-green-400' : 'bg-yellow-500'
                    }`}
                  />
                  <span className={enabled ? 'text-gray-200' : 'text-gray-400'}>{label}</span>
                  <span className="text-xs text-gray-500">{detail}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Tool Reference */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-200">Tool Reference</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {toolCategories.map((cat) => (
            <div
              key={cat.name}
              className="rounded border border-gray-700/50 bg-gray-800/40 px-3 py-2 text-center"
            >
              <div className="text-sm font-medium text-gray-200">{cat.name}</div>
              <div className="text-xs text-gray-500">{cat.count} tools</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500">* conditional — only registered when configured</p>
      </section>

      {/* Quick Links */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-200">Quick Links</h2>
        <div className="flex flex-wrap gap-3">
          <ExtLink href="https://github.com/anthropics/f4tl" label="GitHub" />
          <ExtLink
            href="https://github.com/anthropics/f4tl/blob/main/AGENTS.md"
            label="AGENTS.md"
          />
          <ExtLink href="https://github.com/anthropics/f4tl/blob/main/README.md" label="README" />
        </div>
      </section>
    </div>
  );
}

function Step({ n, title, code }: { n: number; title: string; code: string }) {
  return (
    <div className="rounded-lg border border-gray-700/50 bg-gray-800/30 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500/20 text-xs font-bold text-orange-300">
          {n}
        </span>
        <span className="text-sm font-medium text-gray-200">{title}</span>
      </div>
      <pre className="overflow-x-auto rounded bg-gray-900/60 px-3 py-2 text-xs text-gray-400">
        {code}
      </pre>
    </div>
  );
}

function ExtLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded border border-gray-700/50 bg-gray-800/40 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:border-gray-600 hover:text-gray-100"
    >
      {label}
    </a>
  );
}
