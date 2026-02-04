import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.js';
import { api } from '../lib/api.js';
import { Layout } from '../components/Layout.js';

export function ModsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mods, setMods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    loadMods();
  }, []);

  const loadMods = async () => {
    try {
      setError('');
      const data = await api.listMods();
      setMods(data);
    } catch {
      setError('Failed to load mods');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');
    setUploadProgress(0);
    setUploading(true);

    try {
      await api.uploadMod(file);
      setSuccess('Mod uploaded successfully');
      setUploadProgress(100);
      setTimeout(() => {
        setUploadProgress(0);
        loadMods();
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setError('');
      await api.deleteMod(id);
      setSuccess('Mod deleted');
      setDeleteConfirm(null);
      await loadMods();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Delete failed');
    }
  };

  const formatSize = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return mb.toFixed(2) + ' MB';
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();
  };

  const formatSha256 = (hash: string) => {
    return hash.substring(0, 8) + '...';
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Manage Mods</h1>

        {error && <div className="bg-red-600 text-white p-3 rounded">{error}</div>}
        {success && <div className="bg-green-600 text-white p-3 rounded">{success}</div>}

        {['OWNER', 'ADMIN'].includes(user?.role) && (
          <div className="bg-gray-800 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-bold">Upload Mod</h2>
            <div className="relative">
              <input
                type="file"
                accept=".zip"
                onChange={handleUpload}
                disabled={uploading}
                className="block w-full"
              />
              {uploadProgress > 0 && (
                <div className="mt-2 bg-gray-700 rounded h-2 overflow-hidden">
                  <div
                    className="bg-green-600 h-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
              {uploading && <p className="text-sm text-gray-400 mt-2">Uploading...</p>}
            </div>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-bold">Installed Mods ({mods.length})</h2>
          {loading ? (
            <p>Loading...</p>
          ) : mods.length === 0 ? (
            <p className="text-gray-400">No mods installed</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-gray-400 border-b border-gray-700">
                  <tr>
                    <th className="pb-2 px-2">Filename</th>
                    <th className="pb-2 px-2">Size</th>
                    <th className="pb-2 px-2">SHA256</th>
                    <th className="pb-2 px-2">Uploaded By</th>
                    <th className="pb-2 px-2">Date</th>
                    {['OWNER', 'ADMIN'].includes(user?.role) && <th className="pb-2 px-2">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {mods.map((mod) => (
                    <tr key={mod.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                      <td className="py-3 px-2">{mod.originalName}</td>
                      <td className="py-3 px-2 text-gray-400">{formatSize(mod.size)}</td>
                      <td className="py-3 px-2 font-mono text-xs text-gray-400" title={mod.sha256}>
                        {formatSha256(mod.sha256)}
                      </td>
                      <td className="py-3 px-2">{mod.uploadedBy?.username || 'Unknown'}</td>
                      <td className="py-3 px-2 text-gray-400 text-xs">
                        {formatDate(mod.uploadedAt)}
                      </td>
                      {['OWNER', 'ADMIN'].includes(user?.role) && (
                        <td className="py-3 px-2">
                          {deleteConfirm === mod.id ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleDelete(mod.id)}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(mod.id)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
