import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/', label: 'Sessions' },
  { to: '/live', label: 'Live' },
  { to: '/history', label: 'History' },
  { to: '/config', label: 'Config' },
  { to: '/guide', label: 'Guide' },
];

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-6">
        <span className="text-lg font-bold tracking-tight text-orange-400">f4tl</span>
        <nav className="flex gap-4">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${
                  isActive ? 'text-orange-400' : 'text-gray-400 hover:text-gray-200'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
