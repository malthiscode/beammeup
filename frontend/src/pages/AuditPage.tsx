import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.js';
import { api } from '../lib/api.js';
import { Layout } from '../components/Layout.js';

export function AuditPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else if (!['OWNER', 'ADMIN'].includes(user?.role)) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    api
      .getAuditLogs()
      .then((data) => setLogs(data.logs))
      .catch(() => setError('Failed to load audit logs'))
      .finally(() => setLoading(false));
  }, []);

  const handleExport = async () => {
    try {
      const csv = await api.exportAuditLogs();
      const url = window.URL.createObjectURL(csv);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audit-logs.csv';
      a.click();
    } catch {
      setError('Failed to export logs');
    }
  };

  const actionLabels: Record<string, string> = {
    CONFIG_VIEW: '📖 Config Viewed',
    CONFIG_UPDATE: '⚙️ Config Updated',
    SERVER_RESTART: '🔄 Server Restarted',
    MOD_UPLOAD: '📦 Mod Uploaded',
    MOD_DELETE: '🗑️ Mod Deleted',
    USER_CREATE: '👤 User Created',
    USER_UPDATE: '✏️ User Updated',
    USER_DELETE: '🗑️ User Deleted',
    USER_LOGIN: '🔓 Login',
    USER_LOGOUT: '🔒 Logout',
    AUTHKEY_REPLACE: '🔑 AuthKey Replaced',
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Audit Log</h1>
          <button onClick={handleExport} className="secondary text-sm">
            Export as CSV
          </button>
        </div>

        {error && <div className="bg-red-600 text-white p-3 rounded">{error}</div>}

        <div className="bg-gray-800 rounded-lg p-6">
          {loading ? (
            <p>Loading...</p>
          ) : logs.length === 0 ? (
            <p className="text-gray-400">No audit logs</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="bg-gray-700 p-4 rounded">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">
                        {actionLabels[log.action] || log.action}
                      </p>
                      <p className="text-sm text-gray-400">
                        {log.user.username} • {log.resource}
                        {log.resourceId && ` (${log.resourceId})`}
                      </p>
                      {log.details && (
                        <p className="text-xs text-gray-500 mt-1">{log.details}</p>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
