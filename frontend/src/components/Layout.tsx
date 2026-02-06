import { ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.js';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/config', label: 'Configuration', icon: '⚙️' },
  { path: '/mods', label: 'Mods', icon: '📦' },
];

const adminItems = [
  { path: '/users', label: 'Users', icon: '👥' },
  { path: '/audit', label: 'Audit Log', icon: '📋' },
];

export function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = ['OWNER', 'ADMIN'].includes(user?.role);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const currentNavItem = [...navItems, ...(isAdmin ? adminItems : [])].find(
    (item) => item.path === location.pathname
  );

  return (
    <div className="page flex flex-col md:flex-row min-h-screen">
      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <nav
        className={`fixed md:static w-64 h-screen bg-var(--bg-secondary) border-r border-var(--border-primary) flex flex-col transition-transform z-40 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        aria-label="Navigation"
      >
        {/* Logo */}
        <div className="p-4 border-b border-var(--border-primary)">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity w-full"
          >
            <div className="w-10 h-10 rounded-lg bg-orange-600 flex items-center justify-center font-bold text-white text-lg">
              B
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-white">BeamMeUp</div>
              <div className="text-xs text-var(--text-muted)">Server Manager</div>
            </div>
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-4 px-2">
          <div className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                  location.pathname === item.path
                    ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30'
                    : 'text-var(--text-secondary) hover:bg-var(--bg-hover) hover:text-var(--text-primary)'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}

            {isAdmin && (
              <>
                <div className="my-3 border-t border-var(--border-primary) pt-3">
                  <p className="px-3 text-xs uppercase font-semibold text-var(--text-muted) tracking-wider">
                    Admin
                  </p>
                </div>
                {adminItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                      location.pathname === item.path
                        ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30'
                        : 'text-var(--text-secondary) hover:bg-var(--bg-hover) hover:text-var(--text-primary)'
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* User Info and Logout */}
        <div className="p-4 border-t border-var(--border-primary) space-y-3">
          <div className="bg-var(--bg-hover) rounded-lg p-3">
            <p className="text-xs text-var(--text-muted) uppercase font-semibold tracking-wider">User</p>
            <p className="text-sm font-medium text-white truncate">{user?.username}</p>
            <p className="text-xs text-orange-400 mt-1">{user?.role || 'Viewer'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full btn btn-secondary text-sm justify-center"
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full md:w-auto">
        {/* Top Bar */}
        <header className="bg-var(--bg-secondary) border-b border-var(--border-primary) sticky top-0 z-20">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden btn btn-ghost btn-sm"
              aria-label="Toggle menu"
            >
              ☰
            </button>

            {/* Page Title */}
            <div className="flex-1 md:hidden">
              {currentNavItem && (
                <h1 className="text-lg font-bold text-white">{currentNavItem.label}</h1>
              )}
            </div>

            {/* Spacer */}
            <div className="hidden md:flex" />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
