import axios, { AxiosInstance } from 'axios';

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: '/api',
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load token from localStorage
    this.token = localStorage.getItem('token');

    // Add auth header
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // Handle 401 responses
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.clearAuth();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  clearAuth() {
    this.token = null;
    localStorage.removeItem('token');
  }

  getToken(): string | null {
    return this.token;
  }

  // Auth endpoints
  async login(username: string, password: string) {
    const response = await this.client.post('/auth/login', { username, password });
    if (response.data.token) {
      this.setToken(response.data.token);
    }
    return response.data;
  }

  async logout() {
    await this.client.post('/auth/logout');
    this.clearAuth();
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

  async createOwner(username: string, password: string, email?: string) {
    const response = await this.client.post('/setup/create-owner', {
      username,
      password,
      email,
    });
    if (response.data.token) {
      this.setToken(response.data.token);
    }
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

  async uploadMod(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post('/api/mods/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${this.token}`,
      },
      withCredentials: true,
    });
    return response.data;
  }

  async deleteMod(id: string) {
    const response = await this.client.delete(`/mods/${id}`);
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
