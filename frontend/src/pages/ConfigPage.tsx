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
  const [modMaps, setModMaps] = useState<Array<{ value: string; label: string | null }>>([]);
  const [loadingMaps, setLoadingMaps] = useState(true);
  const [mapScanInfo, setMapScanInfo] = useState<{ timedOut: boolean; skippedLarge: number } | null>(null);
  const [mapLabelInput, setMapLabelInput] = useState('');
  const [savingMapLabel, setSavingMapLabel] = useState(false);

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

  useEffect(() => {
    if (!user || !['OWNER', 'ADMIN'].includes(user.role)) {
      setLoadingMaps(false);
      return;
    }

    setLoadingMaps(true);
    api
      .getAvailableMaps()
      .then((result) => {
        const maps = Array.isArray(result?.maps) ? result.maps : [];
        setModMaps(maps);
        if (result?.timedOut || result?.skippedLarge > 0) {
          setMapScanInfo({
            timedOut: !!result?.timedOut,
            skippedLarge: Number(result?.skippedLarge || 0),
          });
        }
      })
      .catch(() => {
        addNotification('Warning', 'Map list could not be refreshed from mods', 'warning');
      })
      .finally(() => {
        setLoadingMaps(false);
      });
  }, [user, addNotification]);

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

  const currentMapValue = config?.General?.Map || '';
  const serverMapValue = originalConfig?.General?.Map || '';
  const dynamicMapOptions = modMaps.map((map) => ({
    label: `${map.label || formatMapLabel(map.value)} (Mod)`,
    value: map.value,
    source: 'mod' as const,
  }));

  const mergedOptions = [...mapPresets, ...dynamicMapOptions].reduce(
    (acc: Array<{ label: string; value: string; source?: 'mod' }>, option) => {
      if (!acc.some((item) => item.value === option.value)) {
        acc.push(option);
      }
      return acc;
    },
    []
  );

  const optionValues = mergedOptions.map((preset) => preset.value);
  // Use serverMapValue for loading checks since it persists across reloads
  const isMissingMap = !loadingMaps && serverMapValue && !optionValues.includes(serverMapValue);
  const isLoadingMap = loadingMaps && serverMapValue && !optionValues.includes(serverMapValue);
  
  let mapOptions = mergedOptions;
  if (isMissingMap) {
    mapOptions = [
      { label: `Missing map (mod removed or corrupt): ${serverMapValue}`, value: serverMapValue },
      ...mergedOptions
    ];
  } else if (isLoadingMap) {
    mapOptions = [
      { label: `${formatMapLabel(serverMapValue)} (loading...)`, value: serverMapValue },
      ...mergedOptions
    ];
  }

  const selectedModMap = modMaps.find((map) => map.value === currentMapValue) || null;
  const selectedModLabel = selectedModMap?.label || (selectedModMap ? formatMapLabel(selectedModMap.value) : '');
  
  const serverModMap = modMaps.find((map) => map.value === serverMapValue) || null;
  const serverMapDisplayName = serverModMap?.label 
    ? serverModMap.label 
    : formatMapLabel(serverMapValue);
  
  const canSaveMapLabel =
    !!selectedModMap &&
    mapLabelInput.trim().length > 0 &&
    mapLabelInput.trim() !== selectedModLabel;

  useEffect(() => {
    if (selectedModMap) {
      setMapLabelInput(selectedModLabel);
    } else {
      setMapLabelInput('');
    }
  }, [selectedModMap, selectedModLabel]);

  const handleSaveMapLabel = async () => {
    if (!selectedModMap) return;
    const nextLabel = mapLabelInput.trim();
    if (!nextLabel) {
      addNotification('Error', 'Map label cannot be empty', 'error');
      return;
    }

    setSavingMapLabel(true);
    try {
      const updated = await api.updateMapLabel(selectedModMap.value, nextLabel);
      setModMaps((prev) =>
        prev.map((map) => (map.value === updated.mapPath ? { ...map, label: updated.label } : map))
      );
      addNotification('Success', 'Map label updated', 'success');
    } catch (err: any) {
      addNotification('Error', err.response?.data?.error || 'Failed to update map label', 'error');
    } finally {
      setSavingMapLabel(false);
    }
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
                  {serverMapValue ? `Current: ${serverMapDisplayName}` : 'No map configured yet'}
                  {loadingMaps && (
                    <span className="block text-blue-300 mt-1">
                      🔄 Scanning mods for maps...
                    </span>
                  )}
                  {mapScanInfo?.timedOut && (
                    <span className="block text-amber-300 mt-1">
                      ⚠️ Map scan timed out - increase MAP_SCAN_TIMEOUT_MS if needed
                    </span>
                  )}
                  {!!mapScanInfo?.skippedLarge && (
                    <span className="block text-amber-300 mt-1">
                      ⚠️ Skipped {mapScanInfo.skippedLarge} large mod(s) - adjust MAP_SCAN_MAX_ZIP_MB if needed
                    </span>
                  )}
                </p>
                {selectedModMap && ['OWNER', 'ADMIN'].includes(user?.role) && (
                  <div className="form-group">
                    <div className="flex items-center justify-between">
                      <label className="form-label">Custom Mod Map Name</label>
                      <span className="badge badge-warning">Mod</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={mapLabelInput}
                        onChange={(e) => setMapLabelInput(e.target.value)}
                        className="input"
                      />
                      <button
                        type="button"
                        onClick={handleSaveMapLabel}
                        className="btn btn-secondary"
                        disabled={savingMapLabel || !canSaveMapLabel}
                      >
                        {savingMapLabel ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                    <p className="field-hint mt-2">Rename mod maps for a cleaner dropdown label.</p>
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

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              <input
                type="checkbox"
                checked={config?.General?.AllowGuests || false}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    General: { ...config.General, AllowGuests: e.target.checked },
                  })
                }
                className="w-4 h-4 rounded accent-beam-orange cursor-pointer"
              />
              <span className="text-sm font-medium">Allow Guests</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              <input
                type="checkbox"
                checked={config?.General?.LogChat || false}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    General: { ...config.General, LogChat: e.target.checked },
                  })
                }
                className="w-4 h-4 rounded accent-beam-orange cursor-pointer"
              />
              <span className="text-sm font-medium">Log Chat</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              <input
                type="checkbox"
                checked={config?.General?.Debug || false}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    General: { ...config.General, Debug: e.target.checked },
                  })
                }
                className="w-4 h-4 rounded accent-beam-orange cursor-pointer"
              />
              <span className="text-sm font-medium">Debug Mode</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              <input
                type="checkbox"
                checked={config?.General?.Private || false}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    General: { ...config.General, Private: e.target.checked },
                  })
                }
                className="w-4 h-4 rounded accent-beam-orange cursor-pointer"
              />
              <span className="text-sm font-medium">Private Server</span>
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
