import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.js';
import { api } from '../lib/api.js';
import { Layout } from '../components/Layout.js';

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<any>(null);
  const [logs, setLogs] = useState('');
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const loadStatus = async () => {
    try {
      setError('');
      const data = await api.getServerStatus();
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load status');
    }
  };

  const loadLogs = async () => {
    try {
      setError('');
      setLogsLoading(true);
      const data = await api.getServerLogs(200);
      setLogs(data.logs);
    } catch (err: any) {
      setError(err.message || 'Failed to load logs');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    loadLogs();
    setLoading(false);

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      loadStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleRestart = async () => {
    if (!window.confirm('Are you sure you want to restart the server?')) {
      return;
    }

    setRestarting(true);
    try {
      setError('');
      await api.restartServer();
      setSuccess('Server restart initiated');
      setTimeout(() => loadStatus(), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to restart server');
    } finally {
      setRestarting(false);
    }
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (loading) return <Layout><div>Loading...</div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>

        {error && <div className="bg-red-600 text-white p-3 rounded">{error}</div>}
        {success && <div className="bg-green-600 text-white p-3 rounded">{success}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-bold">Server Status</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">State</span>
                <span className={status?.running ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                  {status?.running ? '✅ Running' : '❌ Stopped'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Uptime</span>
                <span className="text-white">{formatUptime(status?.uptime)}</span>
              </div>
              {['OWNER', 'ADMIN', 'OPERATOR'].includes(user?.role) && (
                <button
                  onClick={handleRestart}
                  disabled={restarting}
                  className="w-full mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded font-medium"
                >
                  {restarting ? '🔄 Restarting...' : '🔄 Restart Server'}
                </button>
              )}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/config')}
                className="w-full primary text-left px-4 py-2"
              >
                ⚙️ Edit Configuration
              </button>
              <button
                onClick={() => navigate('/mods')}
                className="w-full secondary text-left px-4 py-2"
              >
                📦 Manage Mods
              </button>
            </div>
          </div>
        </div>

        {/* Logs Viewer */}
        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Recent Logs</h2>
            <button
              onClick={loadLogs}
              disabled={logsLoading}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm disabled:opacity-50"
            >
              {logsLoading ? '🔄 Loading...' : '🔄 Refresh'}
            </button>
          </div>
          <div className="bg-gray-900 rounded p-4 max-h-96 overflow-y-auto font-mono text-sm text-gray-300">
            {logs ? (
              logs.split('\n').map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-words">
                  {line}
                </div>
              ))
            ) : (
              <p className="text-gray-500">No logs available</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
