import axios, { AxiosInstance } from 'axios';

//Helper to read cookie by name
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift();
    return cookieValue || null;
  }
  return null;
}

// Determine API base URL
const getApiBaseUrl = () => {
  const isDev = import.meta.env.DEV;
  
  if (isDev) {
    // In dev mode, use /api (vite proxy will route to backend:3000)
    return '/api';
  }
  
  // In production: Caddy reverse proxy routes /api/* to backend:8200
  // Always use relative path so requests go through the same origin (Caddy)
  return '/api';
};

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    const baseURL = getApiBaseUrl();
    
    this.client = axios.create({
      baseURL,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add CSRF headers
    this.client.interceptors.request.use((config) => {
      // Always read CSRF token from cookie before each request
      const csrfToken = getCookie('csrf_token');
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
      return config;
    });

    // Don't automatically redirect on 401 - let components handle it
    // Some requests (like /auth/me on first load) are expected to return 401
    this.client.interceptors.response.use(
      (response) => response,
      (error) => Promise.reject(error)
    );
  }

  // Fetch CSRF token (sets cookie that will be read by request interceptor)
  async fetchCSRFToken() {
    try {
      await this.client.get('/auth/csrf');
      // Cookie is automatically set by the server, no need to store it
    } catch (error) {
      console.error('[api] Failed to fetch CSRF token:', error);
      throw error;
    }
  }

  // Auth endpoints
  async login(username: string, password: string) {
    // Fetch CSRF token before login
    await this.fetchCSRFToken();
    
    // Proceed with login
    return this._performLogin(username, password);
  }

  private async _performLogin(username: string, password: string) {
    const response = await this.client.post('/auth/login', { username, password });
    if (response.data.user?.id) {
      // Session token is set in cookie, use JWT from response if provided
      // The actual auth is handled by the secure session cookie
    }
    return response.data;
  }

  async logout() {
    await this.client.post('/auth/logout');
    // Session cookie is automatically cleared by the server
  }

  async getCurrentUser() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  // Setup endpoints
  async getSetupStatus() {
    const response = await this.client.get('/setup/status');
    return response.data;
  }

  async createOwner(username: string, password: string, email?: string, authKey?: string) {
    // Fetch CSRF token before setup
    await this.fetchCSRFToken();
    
    const response = await this.client.post('/setup/create-owner', {
      username,
      password,
      email,
      authKey,
    });
    // Session cookie is automatically set by the server
    return response.data;
  }

  // Config endpoints
  async getCurrentConfig() {
    const response = await this.client.get('/config/current');
    return response.data;
  }

  async updateConfig(config: any) {
    const response = await this.client.put('/config/update', config);
    return response.data;
  }

  async getAuthheyStatus() {
    const response = await this.client.get('/config/authkey-status');
    return response.data;
  }

  async replaceAuthkey(newAuthKey: string, password: string) {
    const response = await this.client.post('/config/authkey-replace', { newAuthKey, password });
    return response.data;
  }

  async getAvailableMaps() {
    const response = await this.client.get('/config/maps');
    return response.data;
  }

  async updateMapLabel(mapPath: string, label: string) {
    const response = await this.client.put('/config/maps/label', { mapPath, label });
    return response.data;
  }

  // Server endpoints
  async getServerStatus() {
    const response = await this.client.get('/server/status');
    return response.data;
  }

  async restartServer() {
    const response = await this.client.post('/server/restart');
    return response.data;
  }

  async getServerLogs(lines: number = 200) {
    const response = await this.client.get('/server/logs', { params: { lines } });
    return response.data;
  }

  // Mods endpoints
  async listMods() {
    const response = await this.client.get('/mods/list');
    return response.data;
  }

  async uploadMod(file: File, onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void) {
    // If no progress callback, use simple Axios POST
    if (!onUploadProgress) {
      const formData = new FormData();
      formData.append('file', file);
      const response = await this.client.post('/mods/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    }

    // Use XMLHttpRequest for reliable progress tracking
    const formData = new FormData();
    formData.append('file', file);
    const csrfToken = getCookie('csrf_token');

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Open connection
      xhr.open('POST', '/api/mods/upload', true);
      xhr.withCredentials = true;
      
      // Set CSRF token
      if (csrfToken) {
        xhr.setRequestHeader('X-CSRF-Token', csrfToken);
      }

      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onUploadProgress({
            loaded: event.loaded,
            total: event.total,
          });
        } else {
          // Fallback: use file size as total
          onUploadProgress({
            loaded: event.loaded,
            total: file.size,
          });
        }
      }, false);

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = xhr.responseText ? JSON.parse(xhr.responseText) : {};
            resolve(response);
          } catch (e) {
            resolve({});
          }
        } else {
          let errorMsg = 'Upload failed';
          try {
            const errorData = xhr.responseText ? JSON.parse(xhr.responseText) : null;
            if (errorData?.error) {
              errorMsg = errorData.error;
            }
          } catch (e) {
            // ignore
          }
          reject({ response: { data: { error: errorMsg } } });
        }
      }, false);

      // Handle errors
      xhr.addEventListener('error', () => {
        reject({ response: { data: { error: 'Network error during upload' } } });
      }, false);

      xhr.addEventListener('abort', () => {
        reject({ response: { data: { error: 'Upload cancelled' } } });
      }, false);

      // Send the request
      xhr.send(formData);
    });
  }

  async deleteMod(id: string) {
    const response = await this.client.delete(`/mods/${id}`);
    return response.data;
  }

  async syncMods() {
    const response = await this.client.post('/mods/sync', {});
    return response.data;
  }

  // Users endpoints
  async listUsers() {
    const response = await this.client.get('/users/list');
    return response.data;
  }

  async createUser(username: string, password: string, role: string, email?: string) {
    const response = await this.client.post('/users/create', {
      username,
      password,
      role,
      email,
    });
    return response.data;
  }

  async updateUser(id: string, data: any) {
    const response = await this.client.put(`/users/${id}`, data);
    return response.data;
  }

  async deleteUser(id: string) {
    const response = await this.client.delete(`/users/${id}`);
    return response.data;
  }

  // Audit endpoints
  async getAuditLogs(limit: number = 100, offset: number = 0) {
    const response = await this.client.get('/audit/logs', { params: { limit, offset } });
    return response.data;
  }

  async exportAuditLogs() {
    const response = await this.client.get('/audit/export', {
      responseType: 'blob',
    });
    return response.data;
  }

  // Diagnostics endpoints
  async exportDiagnostics(format: 'json' | 'csv' = 'json') {
    const response = await this.client.get('/diagnostics/export', {
      params: { format },
      responseType: format === 'csv' ? 'blob' : 'json',
    });
    return response.data;
  }

  async getHealthStatus() {
    const response = await this.client.get('/diagnostics/health');
    return response.data;
  }
}

export const api = new ApiClient();
