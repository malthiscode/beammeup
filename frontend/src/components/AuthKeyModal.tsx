import { useState } from 'react';
import { api } from '../lib/api.js';

interface AuthKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AuthKeyModal({ isOpen, onClose, onSuccess }: AuthKeyModalProps) {
  const [password, setPassword] = useState('');
  const [newAuthKey, setNewAuthKey] = useState('');
  const [confirmAuthKey, setConfirmAuthKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Password is required');
      return;
    }

    if (!newAuthKey || newAuthKey.length < 10) {
      setError('AuthKey must be at least 10 characters');
      return;
    }

    if (newAuthKey !== confirmAuthKey) {
      setError('AuthKey values do not match');
      return;
    }

    setLoading(true);
    try {
      await api.replaceAuthkey(newAuthKey, password);
      setPassword('');
      setNewAuthKey('');
      setConfirmAuthKey('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to replace AuthKey');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
        <h2 className="text-xl font-bold">Replace AuthKey</h2>
        <p className="text-sm text-gray-400">
          Enter your password and the new AuthKey. Your current key will not be displayed.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Password (for verification)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500"
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">New AuthKey</label>
            <input
              type="password"
              value={newAuthKey}
              onChange={(e) => setNewAuthKey(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500"
              placeholder="Enter new AuthKey"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Confirm AuthKey</label>
            <input
              type="password"
              value={confirmAuthKey}
              onChange={(e) => setConfirmAuthKey(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500"
              placeholder="Confirm new AuthKey"
              disabled={loading}
            />
          </div>

          {error && <div className="bg-red-600 text-white p-3 rounded text-sm">{error}</div>}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium disabled:opacity-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-medium disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Replacing...' : 'Replace AuthKey'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
