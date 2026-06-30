const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');

const notesRouter = require('./routes/notes');
const linksRouter = require('./routes/links');
const configRouter = require('./routes/config');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static webapp files
app.use(express.static(path.join(__dirname, '../webapp')));

// WebSocket connection handling
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('Client connected. Total clients:', clients.size);

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected. Total clients:', clients.size);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Broadcast function available to routes
function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

app.locals.broadcast = broadcast;

// API Routes
app.use('/api/notes', notesRouter);
app.use('/api/links', linksRouter);
app.use('/api/config', configRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve webapp for any other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../webapp/index.html'));
});

// Start server
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           Meeting Notetaker Server Started                ║
╠═══════════════════════════════════════════════════════════╣
║  Webapp:     http://localhost:${PORT}                        ║
║  API:        http://localhost:${PORT}/api                    ║
║  WebSocket:  ws://localhost:${PORT}                          ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, server, broadcast };
