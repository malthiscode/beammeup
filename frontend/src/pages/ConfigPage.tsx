import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.js';
import { useNotifications } from '../lib/notifications';
import { api } from '../lib/api.js';
import { Layout } from '../components/Layout.js';
import { AuthKeyModal } from '../components/AuthKeyModal.js';

const mapPresets = [
  { label: 'Hirochi Raceway', value: '/levels/hirochi_raceway/info.json' },
  { label: 'West Coast USA', value: '/levels/west_coast_usa/info.json' },
  { label: 'East Coast USA', value: '/levels/east_coast_usa/info.json' },
  { label: 'Italy', value: '/levels/italy/info.json' },
  { label: 'Utah', value: '/levels/utah/info.json' },
  { label: 'Gridmap', value: '/levels/gridmap_v2/info.json' },
  { label: 'Industrial Site', value: '/levels/industrial/info.json' },
  { label: 'Small Island', value: '/levels/small_island/info.json' },
  { label: 'Jungle Rock Island', value: '/levels/jungle_rock_island/info.json' },
  { label: 'Automation Test Track', value: '/levels/automation_test_track/info.json' },
];

const formatMapLabel = (value: string) => {
  const cleaned = value
    .replace(/^\/?levels\//i, '')
    .replace(/\/info\.json$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();

  if (!cleaned) return 'Unknown Map';

  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
};

export function ConfigPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [originalConfig, setOriginalConfig] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [authKeyStatus, setAuthKeyStatus] = useState<{ isSet: boolean; isDefault: boolean } | null>(null);
  const [showAuthKeyModal, setShowAuthKeyModal] = useState(false);
  const [showMapAdvanced, setShowMapAdvanced] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    api
      .getCurrentConfig()
      .then((cfg) => {
        setOriginalConfig(cfg);
        setConfig(cfg);
        setIsDirty(false);
      })
      .finally(() => setLoading(false));

    api
      .getAuthheyStatus()
      .then((status) => setAuthKeyStatus(status))
      .catch(() => setAuthKeyStatus(null));
  }, []);

  // Detect changes
  useEffect(() => {
    if (config && originalConfig) {
      setIsDirty(JSON.stringify(config) !== JSON.stringify(originalConfig));
    }
  }, [config, originalConfig]);

  const handleSave = async (restart: boolean = false) => {
    setSaving(true);

    try {
      await api.updateConfig(config);
      setOriginalConfig(config);
      setIsDirty(false);
      addNotification('Success', 'Configuration saved', 'success');

      if (restart && ['OWNER', 'ADMIN'].includes(user?.role)) {
        await api.restartServer();
        addNotification('Success', 'Server restarted successfully', 'success');
      }
    } catch (err: any) {
      addNotification('Error', err.response?.data?.error || 'Failed to save config', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAuthKeyReplaced = () => {
    addNotification('Success', 'AuthKey replaced successfully', 'success');
    setAuthKeyStatus({ isSet: true, isDefault: false });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted">Loading configuration...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const currentMapValue = config?.General?.Map || '';
  const currentMapLabel = currentMapValue ? formatMapLabel(currentMapValue) : 'Select a map';
  const presetValues = mapPresets.map((preset) => preset.value);
  const showCurrentMap = currentMapValue && !presetValues.includes(currentMapValue);
  const mapOptions = showCurrentMap
    ? [{ label: `${currentMapLabel} (Current)`, value: currentMapValue }, ...mapPresets]
    : mapPresets;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="h1">Server Configuration</h1>
          <p className="subtitle mt-1">Adjust server settings and gameplay options</p>
        </div>

        {isDirty && (
          <div className="bg-amber-500/15 text-amber-200 p-3 rounded-lg border border-amber-500/30">
            <span className="font-semibold">●</span> You have unsaved changes
          </div>
        )}

        {authKeyStatus?.isDefault && (
          <div className="bg-red-500/15 text-red-200 p-4 rounded-lg border border-red-500/30 flex items-start gap-3">
            <span className="text-xl leading-none mt-0.5">⚠️</span>
            <div>
              <p className="font-semibold">AuthKey Not Set</p>
              <p className="text-sm text-red-300 mt-1">
                The BeamMP AuthKey is still set to the default placeholder. Please replace it with a valid key and restart the server for BeamMP connectivity. Players will not be able to connect until this is done.
              </p>
            </div>
          </div>
        )}

        <div className="card-lg space-y-6">
          <h2 className="h3">General Settings</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Server Name</label>
              <input
                type="text"
                value={config?.General?.Name || ''}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    General: { ...config.General, Name: e.target.value },
                  })
                }
                className="input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Port</label>
              <input
                type="number"
                value={config?.General?.Port || 3001}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    General: { ...config.General, Port: parseInt(e.target.value) },
                  })
                }
                className="input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Max Players</label>
              <input
                type="number"
                value={config?.General?.MaxPlayers || 32}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    General: { ...config.General, MaxPlayers: parseInt(e.target.value) },
                  })
                }
                className="input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Max Cars</label>
              <input
                type="number"
                value={config?.General?.MaxCars || 1}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    General: { ...config.General, MaxCars: parseInt(e.target.value) },
                  })
                }
                className="input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Map</label>
              <div className="space-y-3">
                <select
                  value={currentMapValue}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      General: { ...config.General, Map: e.target.value },
                    })
                  }
                  className="input"
                >
                  <option value="">Select a map</option>
                  {mapOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="field-hint">
                  {currentMapValue ? `Current: ${currentMapLabel}` : 'Select a map to apply it.'}
                </p>
                <button
                  type="button"
                  onClick={() => setShowMapAdvanced((prev) => !prev)}
                  className="btn-ghost text-sm px-0"
                >
                  {showMapAdvanced ? 'Hide Advanced Path' : 'Advanced: Edit Map Path'}
                </button>
                {showMapAdvanced && (
                  <div className="form-group">
                    <label className="form-label">Map Path (Advanced)</label>
                    <input
                      type="text"
                      value={currentMapValue}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          General: { ...config.General, Map: e.target.value },
                        })
                      }
                      className="input font-mono text-sm"
                    />
                    <p className="field-hint mt-2">Example: /levels/hirochi_raceway/info.json</p>
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Server IP</label>
              <input
                type="text"
                value={config?.General?.IP || '0.0.0.0'}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    General: { ...config.General, IP: e.target.value },
                  })
                }
                className="input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              value={config?.General?.Description || ''}
              onChange={(e) =>
                setConfig({
                  ...config,
                  General: { ...config.General, Description: e.target.value },
                })
              }
              rows={4}
              className="input"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config?.General?.AllowGuests || false}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    General: { ...config.General, AllowGuests: e.target.checked },
                  })
                }
                className="mr-2"
              />
              Allow Guests
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config?.General?.LogChat || false}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    General: { ...config.General, LogChat: e.target.checked },
                  })
                }
                className="mr-2"
              />
              Log Chat
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config?.General?.Debug || false}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    General: { ...config.General, Debug: e.target.checked },
                  })
                }
                className="mr-2"
              />
              Debug Mode
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config?.General?.Private || false}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    General: { ...config.General, Private: e.target.checked },
                  })
                }
                className="mr-2"
              />
              Private Server
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={() => handleSave(false)} className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
          {['OWNER', 'ADMIN'].includes(user?.role) && (
            <button onClick={() => handleSave(true)} className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save & Restart Server'}
            </button>
          )}
        </div>

        {['OWNER', 'ADMIN'].includes(user?.role) && (
          <div className="card-lg space-y-4">
            <h2 className="h3">Security</h2>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-medium">BeamMP AuthKey</p>
                <div className="flex items-center gap-2 mt-1">
                  {authKeyStatus?.isDefault ? (
                    <>
                      <span className="text-lg">⚠️</span>
                      <p className="text-sm text-red-300 font-semibold">Key not set (using default)</p>
                    </>
                  ) : authKeyStatus?.isSet ? (
                    <>
                      <span className="text-lg">✓</span>
                      <p className="text-sm text-green-300">Key is set</p>
                    </>
                  ) : (
                    <>
                      <span className="text-lg">●</span>
                      <p className="text-sm text-muted">Key not set</p>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowAuthKeyModal(true)}
                className={authKeyStatus?.isDefault ? 'btn btn-danger' : 'btn btn-secondary'}
              >
                Replace AuthKey
              </button>
            </div>
          </div>
        )}

        <AuthKeyModal
          isOpen={showAuthKeyModal}
          onClose={() => setShowAuthKeyModal(false)}
          onSuccess={handleAuthKeyReplaced}
        />
      </div>
    </Layout>
  );
}
