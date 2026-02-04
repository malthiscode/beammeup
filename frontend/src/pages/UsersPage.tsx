import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.js';
import { api } from '../lib/api.js';
import { Layout } from '../components/Layout.js';

export function UsersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'VIEWER',
    email: '',
  });
  const [editData, setEditData] = useState<any>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else if (!['OWNER', 'ADMIN'].includes(user?.role)) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setError('');
      const data = await api.listUsers();
      setUsers(data);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await api.createUser(
        formData.username,
        formData.password,
        formData.role,
        formData.email
      );
      setSuccess('User created');
      setFormData({ username: '', password: '', role: 'VIEWER', email: '' });
      setShowForm(false);
      await loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleEdit = (u: any) => {
    setEditingId(u.id);
    setEditData({ role: u.role, isActive: u.isActive, password: '' });
  };

  const handleSaveEdit = async (id: string) => {
    setError('');
    setSuccess('');

    try {
      await api.updateUser(id, editData);
      setSuccess('User updated');
      setEditingId(null);
      setEditData({});
      await loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update user');
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!window.confirm(`Delete user "${username}"?`)) return;

    try {
      setError('');
      await api.deleteUser(id);
      setSuccess('User deleted');
      await loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Manage Users</h1>

        {error && <div className="bg-red-600 text-white p-3 rounded">{error}</div>}
        {success && <div className="bg-green-600 text-white p-3 rounded">{success}</div>}

        {!showForm && (
          <button onClick={() => setShowForm(true)} className="primary">
            Create User
          </button>
        )}

        {showForm && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">New User</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                >
                  <option>OWNER</option>
                  <option>ADMIN</option>
                  <option>OPERATOR</option>
                  <option>VIEWER</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email (optional)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                />
              </div>

              <div className="flex gap-2">
                <button type="submit" className="primary">
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-bold">Users ({users.length})</h2>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-gray-400 border-b border-gray-700">
                  <tr>
                    <th className="py-2 px-2">Username</th>
                    <th className="py-2 px-2">Role</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2">Last Login</th>
                    <th className="py-2 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    editingId === u.id ? (
                      <tr key={u.id} className="border-b border-gray-700 bg-gray-700/50">
                        <td className="py-3 px-2">{u.username}</td>
                        <td className="py-3 px-2">
                          <select
                            value={editData.role}
                            onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                            className="bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm"
                          >
                            <option>OWNER</option>
                            <option>ADMIN</option>
                            <option>OPERATOR</option>
                            <option>VIEWER</option>
                          </select>
                        </td>
                        <td className="py-3 px-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editData.isActive}
                              onChange={(e) => setEditData({ ...editData, isActive: e.target.checked })}
                            />
                            {editData.isActive ? 'Active' : 'Inactive'}
                          </label>
                        </td>
                        <td className="py-3 px-2 text-xs text-gray-400">
                          {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(u.id)}
                              className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={u.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                        <td className="py-3 px-2">{u.username}</td>
                        <td className="py-3 px-2">{u.role}</td>
                        <td className="py-3 px-2">{u.isActive ? '✓ Active' : '✗ Inactive'}</td>
                        <td className="py-3 px-2 text-xs text-gray-400">
                          {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex gap-2">
                            {u.id !== user?.id && (
                              <>
                                <button
                                  onClick={() => handleEdit(u)}
                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(u.id, u.username)}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
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
