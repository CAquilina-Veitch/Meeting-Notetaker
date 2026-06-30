const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_FILE = path.join(__dirname, '../data/notes-queue.json');

function readNotes() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { notes: [] };
  }
}

function writeNotes(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Get all notes
router.get('/', (req, res) => {
  const data = readNotes();
  res.json(data.notes);
});

// Get pending notes only
router.get('/pending', (req, res) => {
  const data = readNotes();
  const pending = data.notes.filter(n => n.status === 'pending');
  res.json(pending);
});

// Add a new note
router.post('/', (req, res) => {
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Note text is required' });
  }

  const data = readNotes();
  const newNote = {
    id: uuidv4(),
    text: text.trim(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    processedAt: null,
    result: null
  };

  data.notes.unshift(newNote);
  writeNotes(data);

  // Broadcast to WebSocket clients
  if (req.app.locals.broadcast) {
    req.app.locals.broadcast({ type: 'note_added', note: newNote });
  }

  res.status(201).json(newNote);
});

// Update a note (mark as processed, etc.)
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { status, result } = req.body;

  const data = readNotes();
  const noteIndex = data.notes.findIndex(n => n.id === id);

  if (noteIndex === -1) {
    return res.status(404).json({ error: 'Note not found' });
  }

  if (status) {
    data.notes[noteIndex].status = status;
  }
  if (result) {
    data.notes[noteIndex].result = result;
  }
  if (status === 'processed') {
    data.notes[noteIndex].processedAt = new Date().toISOString();
  }

  writeNotes(data);

  // Broadcast to WebSocket clients
  if (req.app.locals.broadcast) {
    req.app.locals.broadcast({ type: 'note_updated', note: data.notes[noteIndex] });
  }

  res.json(data.notes[noteIndex]);
});

// Delete a note
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const data = readNotes();
  const noteIndex = data.notes.findIndex(n => n.id === id);

  if (noteIndex === -1) {
    return res.status(404).json({ error: 'Note not found' });
  }

  const [removed] = data.notes.splice(noteIndex, 1);
  writeNotes(data);

  // Broadcast to WebSocket clients
  if (req.app.locals.broadcast) {
    req.app.locals.broadcast({ type: 'note_deleted', noteId: id });
  }

  res.json(removed);
});

// Clear all processed notes
router.delete('/processed/all', (req, res) => {
  const data = readNotes();
  const originalCount = data.notes.length;
  data.notes = data.notes.filter(n => n.status !== 'processed');
  writeNotes(data);

  const removedCount = originalCount - data.notes.length;

  // Broadcast to WebSocket clients
  if (req.app.locals.broadcast) {
    req.app.locals.broadcast({ type: 'processed_cleared', count: removedCount });
  }

  res.json({ removed: removedCount });
});

module.exports = router;
