import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';

const links = [
  { to: '/', label: 'Sessions' },
  { to: '/live', label: 'Live' },
  { to: '/history', label: 'History' },
  { to: '/agent', label: 'Agent' },
  { to: '/config', label: 'Config' },
  { to: '/guide', label: 'Guide' },
];

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { connected } = useWebSocket();

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-orange-400 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-gray-950"
      >
        Skip to content
      </a>

      <header role="banner" className="border-b border-gray-800 bg-gray-900 px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <span className="text-lg font-bold tracking-tight text-orange-400">f4tl</span>

            {/* Desktop nav */}
            <nav role="navigation" aria-label="Main navigation" className="hidden gap-4 sm:flex">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === '/'}
                  className={({ isActive }) =>
                    `relative text-sm font-medium transition-colors ${
                      isActive ? 'text-orange-400' : 'text-gray-400 hover:text-gray-200'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {l.label}
                      {l.label === 'Live' && connected && (
                        <span
                          className={`absolute -right-2.5 -top-0.5 h-1.5 w-1.5 rounded-full ${isActive ? 'bg-orange-400' : 'bg-green-400'}`}
                          aria-label="Live session active"
                        />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Hamburger button */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 transition-colors hover:text-gray-200 sm:hidden"
            aria-expanded={menuOpen}
            aria-label="Toggle menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <nav
            role="navigation"
            aria-label="Mobile navigation"
            className="mt-3 flex flex-col gap-2 sm:hidden"
          >
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-gray-800 text-orange-400'
                      : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                  }`
                }
              >
                {l.label}
                {l.label === 'Live' && connected && (
                  <span
                    className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-green-400"
                    aria-label="Live session active"
                  />
                )}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main id="main-content" role="main" className="flex-1 p-4 sm:p-6">
        <Outlet />
      </main>

      <footer className="border-t border-gray-800 px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>f4tl — QA Testing Framework</span>
          <span className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-600'}`}
            />
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </footer>
    </div>
  );
}
