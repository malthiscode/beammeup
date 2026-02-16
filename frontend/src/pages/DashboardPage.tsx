import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.js';
import { useNotifications } from '../lib/notifications';
import { api } from '../lib/api.js';
import { Layout } from '../components/Layout.js';

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [status, setStatus] = useState<any>(null);
  const [logs, setLogs] = useState('');
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [currentMap, setCurrentMap] = useState<string>('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const loadStatus = async () => {
    try {
      const data = await api.getServerStatus();
      setStatus(data);
      
      // Load current map with label
      const config = await api.getCurrentConfig();
      if (config?.General?.Map) {
        const mapPath = config.General.Map;
        
        // Try to get custom label from available maps
        try {
          const mapsData = await api.getAvailableMaps();
          const maps = Array.isArray(mapsData?.maps) ? mapsData.maps : [];
          const mapEntry = maps.find((m: any) => m.value === mapPath);
          
          if (mapEntry?.label) {
            setCurrentMap(mapEntry.label);
          } else {
            // Fallback to formatted path if no label found
            const formatted = mapPath
              .replace(/^\/?levels\//i, '')
              .replace(/\/info\.json$/i, '')
              .replace(/[_-]+/g, ' ')
              .trim()
              .replace(/\b\w/g, (char: string) => char.toUpperCase());
            setCurrentMap(formatted || 'None');
          }
        } catch (labelError) {
          // Fallback if label fetch fails
          const formatted = mapPath
            .replace(/^\/?levels\//i, '')
            .replace(/\/info\.json$/i, '')
            .replace(/[_-]+/g, ' ')
            .trim()
            .replace(/\b\w/g, (char: string) => char.toUpperCase());
          setCurrentMap(formatted || 'None');
        }
      }
    } catch (err: any) {
      addNotification('Error', 'Failed to load server status', 'error');
    }
  };

  const loadLogs = async () => {
    try {
      setLogsLoading(true);
      const data = await api.getServerLogs(200);
      setLogs(data.logs);
    } catch (err: any) {
      addNotification('Error', 'Failed to load logs', 'error');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    loadLogs();
    setLoading(false);

    const interval = setInterval(() => {
      loadStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleRestart = async () => {
    if (!window.confirm('Restart the server? This will disconnect all players.')) {
      return;
    }

    setRestarting(true);
    try {
      await api.restartServer();
      addNotification('Success', 'Server restart initiated', 'success');
      setTimeout(() => loadStatus(), 3000);
    } catch (err: any) {
      addNotification('Error', 'Failed to restart server', 'error');
    } finally {
      setRestarting(false);
    }
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return '—';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted">Loading dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="h1">Dashboard</h1>
          <p className="subtitle mt-1">Monitor your BeamMP server in real-time</p>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Server Status */}
          <div className="card-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted uppercase tracking-wider">Server Status</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className={`w-3 h-3 rounded-full ${status?.running ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <p className="text-2xl font-bold">{status?.running ? 'Online' : 'Offline'}</p>
                </div>
              </div>
              <div className={`badge ${status?.running ? 'badge-success' : 'badge-danger'}`}>
                {status?.running ? 'Active' : 'Down'}
              </div>
            </div>
          </div>

          {/* Uptime */}
          <div className="card-lg">
            <p className="text-sm font-medium text-muted uppercase tracking-wider">Uptime</p>
            <p className="text-2xl font-bold mt-2">{formatUptime(status?.uptime)}</p>
            <p className="text-xs text-muted mt-2">
              {status?.uptime ? `Since ${new Date(Date.now() - status.uptime * 1000).toLocaleDateString()}` : '—'}
            </p>
          </div>
        </div>

        {/* Current Map */}
        <div className="card-lg">
          <p className="text-sm font-medium text-muted uppercase tracking-wider">Current Map</p>
          <p className="text-2xl font-bold mt-2">{currentMap || 'Loading...'}</p>
        </div>

        {/* Quick Actions */}
        <div className="card-lg">
          <h2 className="h3 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              onClick={() => navigate('/config')}
              className="btn btn-primary"
            >
              <span className="text-lg">⚙️</span>
              <span className="ml-2">Configuration</span>
            </button>
            <button
              onClick={() => navigate('/mods')}
              className="btn btn-secondary"
            >
              <span className="text-lg">📦</span>
              <span className="ml-2">Manage Mods</span>
            </button>
            {['OWNER', 'ADMIN', 'OPERATOR'].includes(user?.role) && (
              <button
                onClick={handleRestart}
                disabled={restarting}
                className="btn btn-danger"
              >
                <span className="text-lg">{restarting ? '⏳' : '🔄'}</span>
                <span className="ml-2">{restarting ? 'Restarting...' : 'Restart Server'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Recent Logs */}
        <div className="card-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="h3">Recent Logs</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setLogs('')}
                className="btn btn-secondary btn-sm text-sm"
                title="Clear logs display"
              >
                🗑️ Clear
              </button>
              <button
                onClick={loadLogs}
                disabled={logsLoading}
                className="btn btn-secondary btn-sm text-sm"
              >
                {logsLoading ? '🔄' : '↻'} Refresh
              </button>
            </div>
          </div>
          <div className="bg-primary border border-primary rounded-lg p-4 font-mono text-xs text-secondary overflow-x-auto max-h-64 overflow-y-auto">
            {logs ? (
              logs.split('\n').map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-words text-muted leading-relaxed">
                  {line}
                </div>
              ))
            ) : (
              <p className="text-muted italic">No logs available</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
