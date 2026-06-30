const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_FILE = path.join(__dirname, '../data/quick-links.json');

function readLinks() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { sections: [] };
  }
}

function writeLinks(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Get all sections and links
router.get('/', (req, res) => {
  const data = readLinks();
  res.json(data.sections);
});

// Add a new section
router.post('/sections', (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Section name is required' });
  }

  const data = readLinks();
  const maxOrder = Math.max(0, ...data.sections.map(s => s.order));

  const newSection = {
    id: uuidv4(),
    name: name.trim(),
    order: maxOrder + 1,
    links: []
  };

  data.sections.push(newSection);
  writeLinks(data);

  if (req.app.locals.broadcast) {
    req.app.locals.broadcast({ type: 'section_added', section: newSection });
  }

  res.status(201).json(newSection);
});

// Update a section
router.put('/sections/:id', (req, res) => {
  const { id } = req.params;
  const { name, order } = req.body;

  const data = readLinks();
  const section = data.sections.find(s => s.id === id);

  if (!section) {
    return res.status(404).json({ error: 'Section not found' });
  }

  if (name) section.name = name.trim();
  if (order !== undefined) section.order = order;

  writeLinks(data);

  if (req.app.locals.broadcast) {
    req.app.locals.broadcast({ type: 'section_updated', section });
  }

  res.json(section);
});

// Delete a section
router.delete('/sections/:id', (req, res) => {
  const { id } = req.params;

  const data = readLinks();
  const index = data.sections.findIndex(s => s.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Section not found' });
  }

  const [removed] = data.sections.splice(index, 1);
  writeLinks(data);

  if (req.app.locals.broadcast) {
    req.app.locals.broadcast({ type: 'section_deleted', sectionId: id });
  }

  res.json(removed);
});

// Add a link to a section
router.post('/sections/:sectionId/links', (req, res) => {
  const { sectionId } = req.params;
  const { name, url } = req.body;

  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }

  const data = readLinks();
  const section = data.sections.find(s => s.id === sectionId);

  if (!section) {
    return res.status(404).json({ error: 'Section not found' });
  }

  const newLink = {
    id: uuidv4(),
    name: name.trim(),
    url: url.trim(),
    hidden: false,
    createdAt: new Date().toISOString()
  };

  section.links.push(newLink);
  writeLinks(data);

  if (req.app.locals.broadcast) {
    req.app.locals.broadcast({ type: 'link_added', sectionId, link: newLink });
  }

  res.status(201).json(newLink);
});

// Update a link
router.put('/links/:id', (req, res) => {
  const { id } = req.params;
  const { name, url, hidden } = req.body;

  const data = readLinks();
  let foundLink = null;
  let foundSection = null;

  for (const section of data.sections) {
    const link = section.links.find(l => l.id === id);
    if (link) {
      foundLink = link;
      foundSection = section;
      break;
    }
  }

  if (!foundLink) {
    return res.status(404).json({ error: 'Link not found' });
  }

  if (name) foundLink.name = name.trim();
  if (url) foundLink.url = url.trim();
  if (hidden !== undefined) foundLink.hidden = hidden;

  writeLinks(data);

  if (req.app.locals.broadcast) {
    req.app.locals.broadcast({ type: 'link_updated', sectionId: foundSection.id, link: foundLink });
  }

  res.json(foundLink);
});

// Delete a link
router.delete('/links/:id', (req, res) => {
  const { id } = req.params;

  const data = readLinks();
  let removed = null;
  let sectionId = null;

  for (const section of data.sections) {
    const index = section.links.findIndex(l => l.id === id);
    if (index !== -1) {
      [removed] = section.links.splice(index, 1);
      sectionId = section.id;
      break;
    }
  }

  if (!removed) {
    return res.status(404).json({ error: 'Link not found' });
  }

  writeLinks(data);

  if (req.app.locals.broadcast) {
    req.app.locals.broadcast({ type: 'link_deleted', sectionId, linkId: id });
  }

  res.json(removed);
});

// Reorder sections
router.put('/reorder/sections', (req, res) => {
  const { order } = req.body; // Array of section IDs in new order

  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'Order must be an array of section IDs' });
  }

  const data = readLinks();

  order.forEach((id, index) => {
    const section = data.sections.find(s => s.id === id);
    if (section) {
      section.order = index;
    }
  });

  data.sections.sort((a, b) => a.order - b.order);
  writeLinks(data);

  if (req.app.locals.broadcast) {
    req.app.locals.broadcast({ type: 'sections_reordered', sections: data.sections });
  }

  res.json(data.sections);
});

module.exports = router;
