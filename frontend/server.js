const express = require('express');
const path = require('path');
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

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(3000, '0.0.0.0', () => {
  console.log('Frontend server listening on 0.0.0.0:3000');
});
