const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Serve static files with correct MIME types
app.use(express.static('./dist', {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
    if (filePath.endsWith('.json')) res.setHeader('Content-Type', 'application/json');
    if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
    if (filePath.endsWith('.svg')) res.setHeader('Content-Type', 'image/svg+xml');
    if (filePath.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
  }
}));

// Proxy API requests to backend
// In Docker, backend is on beammeup-backend:3000 (internal network)
// Locally, backend is on localhost:8200
const backendUrl = process.env.BACKEND_URL || 'http://beammeup-backend:3000';
app.use('/api', createProxyMiddleware({
  target: backendUrl,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api', // Keep the /api prefix
  },
}));

// SPA fallback - serve index.html for all non-API routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(3000, '0.0.0.0', () => {
  console.log('Frontend server listening on 0.0.0.0:3000');
  console.log('API proxy configured to:', backendUrl);
});
