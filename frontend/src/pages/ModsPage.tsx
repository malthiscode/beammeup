import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.js';
import { useNotifications } from '../lib/notifications';
import { api } from '../lib/api.js';
import { Layout } from '../components/Layout.js';

type FileStatus = 'pending' | 'uploading' | 'success' | 'error';

interface FileWithStatus {
  file: File;
  status: FileStatus;
  error?: string;
  id: string;
  progress?: number; // 0-100
}

export function ModsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [mods, setMods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filesWithStatus, setFilesWithStatus] = useState<FileWithStatus[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedModIds, setSelectedModIds] = useState<string[]>([]);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<'name' | 'size' | 'sha256' | 'author' | 'date' | 'status'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const MAX_FILE_SIZE_MB = 2048; // Must match backend MAX_MOD_SIZE

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    loadMods();
  }, []);

  useEffect(() => {
    setSelectedModIds((prev) => prev.filter((id) => mods.some((mod) => mod.id === id)));
  }, [mods]);

  const loadMods = async () => {
    try {
      const data = await api.listMods();
      setMods(data);
    } catch {
      addNotification('Error', 'Failed to load mods', 'error');
    } finally {
      setLoading(false);
    }
  };

  const validateAndAddFiles = (files: File[]) => {
    const newFiles: FileWithStatus[] = [];
    for (const file of files) {
      // Validate file type
      if (!file.name.toLowerCase().endsWith('.zip')) {
        addNotification('Error', `${file.name} is not a ZIP file`, 'error');
        continue;
      }

      // Validate file size
      const fileSizeMB = file.size / 1024 / 1024;
      if (fileSizeMB > MAX_FILE_SIZE_MB) {
        addNotification('Error', `${file.name} exceeds ${MAX_FILE_SIZE_MB}MB limit (${fileSizeMB.toFixed(2)}MB)`, 'error');
        continue;
      }

      // Check for duplicate
      const isDuplicate = filesWithStatus.some(f => f.file.name === file.name && f.file.size === file.size);
      if (isDuplicate) {
        continue;
      }

      newFiles.push({
        file,
        status: 'pending',
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      });
    }

    if (newFiles.length > 0) {
      setFilesWithStatus(prev => [...prev, ...newFiles]);
    }
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    validateAndAddFiles(files);
    // Clear input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    validateAndAddFiles(files);
  };

  const handleUploadAll = async () => {
    const pendingFiles = filesWithStatus.filter(f => f.status === 'pending' || f.status === 'error');
    if (pendingFiles.length === 0) return;

    setUploading(true);
    let successCount = 0;

    for (const fileWithStatus of pendingFiles) {
      // Update status to uploading
      setFilesWithStatus(prev =>
        prev.map(f =>
          f.id === fileWithStatus.id
            ? { ...f, status: 'uploading' as FileStatus, error: undefined, progress: 0 }
            : f
        )
      );

      try {
        await api.uploadMod(fileWithStatus.file, (progressEvent) => {
          const totalBytes = progressEvent.total || fileWithStatus.file.size;
          const percentCompleted = totalBytes > 0
            ? Math.min(100, Math.round((progressEvent.loaded * 100) / totalBytes))
            : 0;
          
          setFilesWithStatus(prev =>
            prev.map(f =>
              f.id === fileWithStatus.id
                ? { ...f, progress: percentCompleted }
                : f
            )
          );
        });
        successCount += 1;
        
        // Update status to success
        setFilesWithStatus(prev =>
          prev.map(f =>
            f.id === fileWithStatus.id
              ? { ...f, status: 'success' as FileStatus, progress: 100 }
              : f
          )
        );
      } catch (err: any) {
        const errorMsg = err.response?.data?.error || 'Upload failed';
        
        // Update status to error
        setFilesWithStatus(prev =>
          prev.map(f =>
            f.id === fileWithStatus.id
              ? { ...f, status: 'error' as FileStatus, error: errorMsg }
              : f
          )
        );
      }
    }

    setUploading(false);

    if (successCount > 0) {
      addNotification('Success', `Uploaded ${successCount} mod(s) successfully`, 'success');
      // Reload mods list
      await loadMods();
      
      // Remove only successful files after a delay
      setTimeout(() => {
        setFilesWithStatus(prev => prev.filter(f => f.status !== 'success'));
      }, 2000);
    }

    const failCount = pendingFiles.length - successCount;
    if (failCount > 0) {
      addNotification('Warning', `${failCount} mod(s) failed to upload`, 'warning');
    }
  };

  const removeFile = (id: string) => {
    setFilesWithStatus(prev => prev.filter(f => f.id !== id));
  };

  const clearAllFiles = () => {
    setFilesWithStatus([]);
  };

  const clearSuccessful = () => {
    setFilesWithStatus(prev => prev.filter(f => f.status !== 'success'));
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingIds((prev) => [...prev, id]);
      await api.deleteMod(id);
      addNotification('Success', 'Mod deleted', 'success');
      setDeleteConfirm(null);
      setSelectedModIds((prev) => prev.filter((selectedId) => selectedId !== id));
      await loadMods();
    } catch (err: any) {
      addNotification('Error', err.response?.data?.error || 'Delete failed', 'error');
    } finally {
      setDeletingIds((prev) => prev.filter((deleteId) => deleteId !== id));
    }
  };

  const toggleSelectMod = (id: string) => {
    setSelectedModIds((prev) =>
      prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (allSelected && filteredMods.length > 0) {
      setSelectedModIds([]);
      return;
    }
    setSelectedModIds(filteredMods.map((mod) => mod.id));
  };

  const clearSelection = () => {
    setSelectedModIds([]);
  };

  const handleBulkDelete = async () => {
    if (selectedModIds.length === 0) return;
    setBulkDeleting(true);
    setDeleteConfirm(null);

    let successCount = 0;
    let failCount = 0;

    for (const id of selectedModIds) {
      try {
        setDeletingIds((prev) => [...prev, id]);
        await api.deleteMod(id);
        successCount += 1;
      } catch (err: any) {
        failCount += 1;
        addNotification('Error', err.response?.data?.error || 'Delete failed', 'error');
      } finally {
        setDeletingIds((prev) => prev.filter((deleteId) => deleteId !== id));
      }
    }

    if (successCount > 0) {
      addNotification('Success', `Deleted ${successCount} mod(s)`, 'success');
    }

    if (failCount > 0) {
      addNotification('Warning', `${failCount} mod(s) failed to delete`, 'warning');
    }

    setBulkDeleting(false);
    setBulkDeleteConfirm(false);
    setSelectedModIds([]);
    await loadMods();
  };

  const handleSyncFilesystem = async () => {
    setSyncing(true);
    try {
      const result = await api.syncMods();
      
      if (result.untrackedFiles?.length > 0 || result.missingFiles?.length > 0) {
        let message = '';
        if (result.untrackedFiles?.length > 0) {
          message += `Found ${result.untrackedFiles.length} untracked file(s). `;
        }
        if (result.missingFiles?.length > 0) {
          message += `Found ${result.missingFiles.length} missing file(s). `;
        }
        addNotification('Sync Complete', message.trim(), 'success');
      } else {
        addNotification('Sync Complete', 'Filesystem and database are in sync', 'success');
      }
      
      await loadMods();
    } catch (err: any) {
      addNotification('Error', err.response?.data?.error || 'Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const formatSize = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    if (mb >= 1024) {
      return (mb / 1024).toFixed(2) + ' GB';
    }
    return mb.toFixed(2) + ' MB';
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();
  };

  const formatSha256 = (hash: string) => {
    return hash.substring(0, 8) + '...';
  };

  const getStatusIcon = (status: FileStatus) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'uploading':
        return '⬆️';
      case 'success':
        return '✅';
      case 'error':
        return '❌';
    }
  };

  const getStatusColor = (status: FileStatus) => {
    switch (status) {
      case 'pending':
        return 'text-gray-400';
      case 'uploading':
        return 'text-blue-400';
      case 'success':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
    }
  };

  const pendingCount = filesWithStatus.filter(f => f.status === 'pending' || f.status === 'error').length;
  const uploadingCount = filesWithStatus.filter(f => f.status === 'uploading').length;
  const successCount = filesWithStatus.filter(f => f.status === 'success').length;
  
  const filteredMods = mods
    .filter(mod => {
      const query = searchQuery.toLowerCase();
      return (
        mod.originalName.toLowerCase().includes(query) ||
        mod.filename.toLowerCase().includes(query) ||
        mod.uploadedBy?.username.toLowerCase().includes(query) ||
        mod.sha256.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      let aVal: any = null;
      let bVal: any = null;

      switch (sortColumn) {
        case 'name':
          aVal = a.originalName.toLowerCase();
          bVal = b.originalName.toLowerCase();
          break;
        case 'size':
          aVal = a.size;
          bVal = b.size;
          break;
        case 'sha256':
          aVal = a.sha256.toLowerCase();
          bVal = b.sha256.toLowerCase();
          break;
        case 'author':
          aVal = (a.uploadedBy?.username || '').toLowerCase();
          bVal = (b.uploadedBy?.username || '').toLowerCase();
          break;
        case 'date':
          aVal = new Date(a.uploadedAt).getTime();
          bVal = new Date(b.uploadedAt).getTime();
          break;
        case 'status':
          aVal = a.isMissing ? 1 : 0;
          bVal = b.isMissing ? 1 : 0;
          break;
      }

      if (aVal === null || bVal === null) return 0;
      
      if (typeof aVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

  const handleSort = (column: 'name' | 'size' | 'sha256' | 'author' | 'date' | 'status') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };
  
  const allSelected = filteredMods.length > 0 && filteredMods.every((mod) => selectedModIds.includes(mod.id));
  const isAdmin = ['OWNER', 'ADMIN'].includes(user?.role);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="h1">Mod Management</h1>
          <p className="subtitle mt-1">Upload and manage server mod files</p>
        </div>

        {isAdmin && (
          <div className="card-lg space-y-4">
            <h2 className="h3">Upload Mods</h2>
            
            {/* Drag and Drop Zone */}
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                dragActive
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-subtle hover:border-orange-500/50'
              } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                multiple
                onChange={handleFileSelection}
                disabled={uploading}
                className="hidden"
                id="mod-file-input"
              />
              <label
                htmlFor="mod-file-input"
                className="cursor-pointer flex flex-col items-center space-y-2"
              >
                <div className="text-4xl">📦</div>
                <div className="text-lg font-medium text-white">
                  Drop mod files here or click to browse
                </div>
                <div className="text-sm text-muted">
                  ZIP files only • Max {MAX_FILE_SIZE_MB}MB per file
                </div>
              </label>
            </div>

            {/* File List with Status */}
            {filesWithStatus.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted">
                    {filesWithStatus.length} file(s) • 
                    {pendingCount > 0 && <span className="ml-1">{pendingCount} pending</span>}
                    {uploadingCount > 0 && <span className="ml-1 text-blue-400">{uploadingCount} uploading</span>}
                    {successCount > 0 && <span className="ml-1 text-green-400">{successCount} uploaded</span>}
                  </div>
                  <div className="flex gap-2">
                    {successCount > 0 && !uploading && (
                      <button
                        type="button"
                        onClick={clearSuccessful}
                        className="text-xs text-green-300 hover:text-green-200"
                      >
                        Clear Successful
                      </button>
                    )}
                    {!uploading && (
                      <button
                        type="button"
                        onClick={clearAllFiles}
                        className="text-xs text-orange-300 hover:text-orange-200"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto border border-subtle rounded-lg divide-y divide-subtle">
                  {filesWithStatus.map((fileWithStatus) => (
                    <div
                      key={fileWithStatus.id}
                      className="flex items-start justify-between p-3 hover:bg-hover transition-colors"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-xl flex-shrink-0 mt-0.5">
                          {getStatusIcon(fileWithStatus.status)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">
                            {fileWithStatus.file.name}
                          </div>
                          <div className="text-xs text-muted">
                            {formatSize(fileWithStatus.file.size)}
                          </div>
                          {fileWithStatus.error && (
                            <div className="text-xs text-red-400 mt-1">
                              {fileWithStatus.error}
                            </div>
                          )}
                        </div>
                        <div className={`text-xs ${getStatusColor(fileWithStatus.status)} flex-shrink-0 min-w-[80px]`}>
                          {fileWithStatus.status === 'pending' && 'Pending'}
                          {fileWithStatus.status === 'uploading' && (
                            <div className="flex items-center gap-1">
                              <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500 transition-all duration-300"
                                  style={{ width: `${fileWithStatus.progress || 0}%` }}
                                />
                              </div>
                              <span className="text-[10px]">{fileWithStatus.progress || 0}%</span>
                            </div>
                          )}
                          {fileWithStatus.status === 'success' && 'Success'}
                          {fileWithStatus.status === 'error' && 'Failed'}
                        </div>
                      </div>
                      {(fileWithStatus.status === 'pending' || fileWithStatus.status === 'error') && !uploading && (
                        <button
                          type="button"
                          onClick={() => removeFile(fileWithStatus.id)}
                          className="text-xs text-red-300 hover:text-red-200 ml-3 flex-shrink-0"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {pendingCount > 0 && (
                  <button
                    type="button"
                    onClick={handleUploadAll}
                    className="btn btn-primary w-full"
                    disabled={uploading}
                  >
                    {uploading
                      ? `Uploading... (${uploadingCount}/${pendingCount})`
                      : `Upload ${pendingCount} Mod${pendingCount > 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="card-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="h3">Installed Mods</h2>
            <div className="flex items-center gap-3">
              <span className="badge badge-warning">{mods.length} Total</span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleSyncFilesystem}
                  className="btn btn-secondary btn-sm text-xs"
                  disabled={syncing || loading || bulkDeleting}
                >
                  {syncing ? 'Syncing...' : 'Refresh Filesystem'}
                </button>
              )}
              {isAdmin && selectedModIds.length > 0 && !bulkDeleteConfirm && (
                <button
                  type="button"
                  onClick={() => setBulkDeleteConfirm(true)}
                  className="btn btn-danger btn-sm text-xs"
                  disabled={bulkDeleting}
                >
                  Delete Selected ({selectedModIds.length})
                </button>
              )}
              {isAdmin && bulkDeleteConfirm && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="btn btn-danger btn-sm text-xs"
                    disabled={bulkDeleting}
                  >
                    Confirm Delete ({selectedModIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkDeleteConfirm(false)}
                    className="btn btn-secondary btn-sm text-xs"
                    disabled={bulkDeleting}
                  >
                    Cancel
                  </button>
                </div>
              )}
              {isAdmin && selectedModIds.length > 0 && !bulkDeleteConfirm && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="btn btn-secondary btn-sm text-xs"
                  disabled={bulkDeleting}
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>
          
          {mods.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search mods by name, file, author, or SHA256..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 bg-input border border-subtle rounded-lg text-white placeholder-muted focus:outline-none focus:border-primary transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted hover:text-white transition-colors"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
              {filteredMods.length !== mods.length && (
                <span className="text-sm text-muted">{filteredMods.length} of {mods.length} shown</span>
              )}
            </div>
          )}
          
          {loading ? (
            <div className="card px-6 py-4">Loading...</div>
          ) : mods.length === 0 ? (
            <p className="text-muted">No mods installed</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead className="text-left text-secondary border-b border-primary">
                  <tr>
                    {isAdmin && (
                      <th className="pb-3 px-4 w-8">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          disabled={bulkDeleting || filteredMods.length === 0}
                        />
                      </th>
                    )}
                    <th 
                      className="pb-3 px-4 cursor-pointer hover:text-orange-400 transition-colors select-none"
                      onClick={() => handleSort('name')}
                    >
                      Filename {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="pb-3 px-4 cursor-pointer hover:text-orange-400 transition-colors select-none"
                      onClick={() => handleSort('size')}
                    >
                      Size {sortColumn === 'size' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="pb-3 px-4 cursor-pointer hover:text-orange-400 transition-colors select-none"
                      onClick={() => handleSort('sha256')}
                    >
                      SHA256 {sortColumn === 'sha256' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="pb-3 px-4 cursor-pointer hover:text-orange-400 transition-colors select-none"
                      onClick={() => handleSort('author')}
                    >
                      Uploaded By {sortColumn === 'author' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="pb-3 px-4 cursor-pointer hover:text-orange-400 transition-colors select-none"
                      onClick={() => handleSort('date')}
                    >
                      Date {sortColumn === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="pb-3 px-4 cursor-pointer hover:text-orange-400 transition-colors select-none"
                      onClick={() => handleSort('status')}
                    >
                      Status {sortColumn === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    {isAdmin && <th className="pb-3 px-4">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredMods.map((mod) => (
                    <tr key={mod.id} className="border-b border-subtle hover:bg-hover transition-colors">
                      {isAdmin && (
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedModIds.includes(mod.id)}
                            onChange={() => toggleSelectMod(mod.id)}
                            disabled={bulkDeleting || deletingIds.includes(mod.id)}
                          />
                        </td>
                      )}
                      <td className="py-3 px-4 font-medium text-white">{mod.originalName}</td>
                      <td className="py-3 px-4 text-muted">{formatSize(mod.size)}</td>
                      <td className="py-3 px-4 font-mono text-xs text-muted" title={mod.sha256}>
                        {formatSha256(mod.sha256)}
                      </td>
                      <td className="py-3 px-4">{mod.uploadedBy?.username || 'Unknown'}</td>
                      <td className="py-3 px-4 text-muted text-xs">
                        {formatDate(mod.uploadedAt)}
                      </td>
                      <td className="py-3 px-4">
                        {mod.isMissing ? (
                          <span className="text-xs badge badge-danger">Missing</span>
                        ) : (
                          <span className="text-xs badge badge-success">OK</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4">
                          {deleteConfirm === mod.id ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleDelete(mod.id)}
                                className="btn btn-danger btn-sm text-xs"
                                disabled={bulkDeleting || deletingIds.includes(mod.id)}
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="btn btn-secondary btn-sm text-xs"
                                disabled={bulkDeleting}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(mod.id)}
                              className="btn btn-danger btn-sm text-xs"
                              disabled={bulkDeleting || deletingIds.includes(mod.id)}
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
