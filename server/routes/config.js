const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/config.json');

function readConfig() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { googleDocId: null, googleDocUrl: null, lastUpdated: null };
  }
}

function writeConfig(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function extractDocId(url) {
  // Extract document ID from various Google Docs URL formats
  // https://docs.google.com/document/d/DOCUMENT_ID/edit
  // https://docs.google.com/document/d/DOCUMENT_ID/edit?...
  const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// Get config
router.get('/', (req, res) => {
  const config = readConfig();
  res.json(config);
});

// Update config
router.put('/', (req, res) => {
  const { googleDocUrl } = req.body;
  const config = readConfig();

  if (googleDocUrl !== undefined) {
    config.googleDocUrl = googleDocUrl;
    config.googleDocId = googleDocUrl ? extractDocId(googleDocUrl) : null;
    config.lastUpdated = new Date().toISOString();
  }

  writeConfig(config);

  if (req.app.locals.broadcast) {
    req.app.locals.broadcast({ type: 'config_updated', config });
  }

  res.json(config);
});

module.exports = router;
