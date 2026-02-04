import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.js';

export function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold">BeamMeUp</div>

          <div className="flex gap-6">
            <button onClick={() => navigate('/dashboard')} className="hover:text-blue-400">
              Dashboard
            </button>
            <button onClick={() => navigate('/config')} className="hover:text-blue-400">
              Config
            </button>
            <button onClick={() => navigate('/mods')} className="hover:text-blue-400">
              Mods
            </button>
            {['OWNER', 'ADMIN'].includes(user?.role) && (
              <>
                <button onClick={() => navigate('/users')} className="hover:text-blue-400">
                  Users
                </button>
                <button onClick={() => navigate('/audit')} className="hover:text-blue-400">
                  Audit
                </button>
              </>
            )}
          </div>

          <div className="flex gap-4 items-center">
            <span className="text-sm text-gray-400">{user?.username}</span>
            <button onClick={handleLogout} className="secondary text-sm">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
