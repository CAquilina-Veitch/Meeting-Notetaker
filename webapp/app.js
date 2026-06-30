// State
let notes = [];
let links = [];
let config = {};
let ws = null;

// DOM Elements
const docUrl = document.getElementById('docUrl');
const docStatus = document.getElementById('docStatus');
const openDocBtn = document.getElementById('openDocBtn');
const quickLinksContainer = document.getElementById('quickLinksContainer');
const notesInput = document.getElementById('notesInput');
const clearBtn = document.getElementById('clearBtn');
const queuedNotes = document.getElementById('queuedNotes');
const processedNotes = document.getElementById('processedNotes');
const pendingCount = document.getElementById('pendingCount');
const processedCount = document.getElementById('processedCount');
const clearProcessedBtn = document.getElementById('clearProcessedBtn');
const connectionIndicator = document.getElementById('connectionIndicator');

// Modals
const addLinkModal = document.getElementById('addLinkModal');
const addSectionModal = document.getElementById('addSectionModal');
const addLinkBtn = document.getElementById('addLinkBtn');
const addSectionBtn = document.getElementById('addSectionBtn');

// API Functions
const api = {
  async get(endpoint) {
    const res = await fetch(`/api${endpoint}`);
    return res.json();
  },
  async post(endpoint, data) {
    const res = await fetch(`/api${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async put(endpoint, data) {
    const res = await fetch(`/api${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async delete(endpoint) {
    const res = await fetch(`/api${endpoint}`, { method: 'DELETE' });
    return res.json();
  }
};

// WebSocket Connection
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    console.log('WebSocket connected');
    updateConnectionStatus(true);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    updateConnectionStatus(false);
    // Reconnect after 3 seconds
    setTimeout(connectWebSocket, 3000);
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleWebSocketMessage(message);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

function updateConnectionStatus(connected) {
  if (connectionIndicator) {
    connectionIndicator.classList.toggle('connected', connected);
    connectionIndicator.title = connected ? 'Connected' : 'Disconnected';
  }
}

function handleWebSocketMessage(message) {
  switch (message.type) {
    case 'note_added':
      notes.unshift(message.note);
      renderNotes();
      break;
    case 'note_updated':
      const noteIdx = notes.findIndex(n => n.id === message.note.id);
      if (noteIdx !== -1) {
        notes[noteIdx] = message.note;
        renderNotes();
      }
      break;
    case 'note_deleted':
      notes = notes.filter(n => n.id !== message.noteId);
      renderNotes();
      break;
    case 'processed_cleared':
      notes = notes.filter(n => n.status !== 'processed');
      renderNotes();
      break;
    case 'section_added':
    case 'section_updated':
    case 'section_deleted':
    case 'link_added':
    case 'link_updated':
    case 'link_deleted':
    case 'sections_reordered':
      loadLinks();
      break;
    case 'config_updated':
      config = message.config;
      updateDocDisplay();
      break;
  }
}

// Load initial data
async function loadData() {
  try {
    [notes, links, config] = await Promise.all([
      api.get('/notes'),
      api.get('/links'),
      api.get('/config')
    ]);
    renderNotes();
    renderLinks();
    updateDocDisplay();
  } catch (error) {
    console.error('Failed to load data:', error);
  }
}

async function loadLinks() {
  try {
    links = await api.get('/links');
    renderLinks();
  } catch (error) {
    console.error('Failed to load links:', error);
  }
}

// Render Functions
function renderNotes() {
  const pending = notes.filter(n => n.status === 'pending');
  const processed = notes.filter(n => n.status === 'processed');

  pendingCount.textContent = pending.length;
  if (processedCount) {
    processedCount.textContent = processed.length;
  }

  // Render pending notes
  if (pending.length === 0) {
    queuedNotes.innerHTML = '<div class="empty-state">No notes in queue</div>';
  } else {
    queuedNotes.innerHTML = pending.map(note => `
      <div class="note-item" data-id="${note.id}">
        <span class="note-icon">&#9711;</span>
        <div class="note-content">
          <div class="note-text">${escapeHtml(note.text)}</div>
          <div class="note-time">${formatTime(note.createdAt)}</div>
        </div>
        <div class="note-actions">
          <button onclick="deleteNote('${note.id}')" title="Delete">&#10005;</button>
        </div>
      </div>
    `).join('');
  }

  // Render processed notes
  if (processed.length === 0) {
    processedNotes.innerHTML = '<div class="empty-state">No processed notes yet</div>';
  } else {
    processedNotes.innerHTML = processed.slice(0, 10).map(note => `
      <div class="note-item processed" data-id="${note.id}">
        <span class="note-icon">&#10003;</span>
        <div class="note-content">
          <div class="note-text">${escapeHtml(note.text)}</div>
          ${note.result ? `<div class="note-result">${formatResult(note.result)}</div>` : ''}
          <div class="note-time">${formatTime(note.processedAt || note.createdAt)}</div>
        </div>
      </div>
    `).join('');
  }
}

function renderLinks() {
  if (links.length === 0) {
    quickLinksContainer.innerHTML = '<div class="empty-state">No quick links yet</div>';
    return;
  }

  const sortedSections = [...links].sort((a, b) => a.order - b.order);

  quickLinksContainer.innerHTML = sortedSections.map(section => `
    <div class="link-section" data-section-id="${section.id}">
      <div class="link-section-header">
        <span>${escapeHtml(section.name)}</span>
        <div class="link-section-actions">
          <button onclick="editSection('${section.id}')" title="Edit">Edit</button>
          <button onclick="deleteSection('${section.id}')" title="Delete">&#10005;</button>
        </div>
      </div>
      <div class="link-items">
        ${section.links.length === 0
          ? '<div class="empty-state">No links</div>'
          : section.links.map(link => `
            <div class="link-item ${link.hidden ? 'hidden' : ''}" data-link-id="${link.id}">
              <div class="link-info">
                <span class="link-icon">${getLinkIcon(link.url)}</span>
                <span class="link-name">${escapeHtml(link.name)}</span>
              </div>
              <div class="link-actions">
                <button onclick="toggleLinkVisibility('${link.id}', ${!link.hidden})">${link.hidden ? 'show' : 'hide'}</button>
                <button onclick="openLink('${escapeHtml(link.url)}')" title="Open">open</button>
                <button onclick="deleteLink('${link.id}')" title="Delete">&#10005;</button>
              </div>
            </div>
          `).join('')
        }
      </div>
    </div>
  `).join('');

  updateSectionSelect();
}

function updateDocDisplay() {
  if (config.googleDocUrl) {
    docUrl.value = config.googleDocUrl;
    docStatus.textContent = config.googleDocId ? `ID: ${config.googleDocId}` : '';
    docStatus.className = 'doc-status success';
  } else {
    docUrl.value = '';
    docStatus.textContent = '';
    docStatus.className = 'doc-status';
  }
}

function updateSectionSelect() {
  const select = document.getElementById('linkSection');
  if (select && links.length > 0) {
    select.innerHTML = links.map(s =>
      `<option value="${s.id}">${escapeHtml(s.name)}</option>`
    ).join('');
  }
}

// Helper Functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatResult(result) {
  if (typeof result === 'string') return result;
  if (result.addedTo && Array.isArray(result.addedTo)) {
    return `Added to: ${result.addedTo.join(', ')}`;
  }
  return JSON.stringify(result);
}

function getLinkIcon(url) {
  if (url.includes('docs.google.com/document')) return '&#128196;';
  if (url.includes('docs.google.com/spreadsheets')) return '&#128202;';
  if (url.includes('docs.google.com/presentation')) return '&#128202;';
  if (url.includes('drive.google.com')) return '&#128193;';
  if (url.includes('github.com')) return '&#128187;';
  return '&#128279;';
}

// Event Handlers
async function queueNote() {
  const text = notesInput.value.trim();
  if (!text) return;

  try {
    await api.post('/notes', { text });
    notesInput.value = '';
    notesInput.focus();
  } catch (error) {
    console.error('Failed to queue note:', error);
  }
}

async function deleteNote(id) {
  try {
    await api.delete(`/notes/${id}`);
  } catch (error) {
    console.error('Failed to delete note:', error);
  }
}

async function clearProcessed() {
  try {
    await api.delete('/notes/processed/all');
  } catch (error) {
    console.error('Failed to clear processed notes:', error);
  }
}

async function saveDocUrl() {
  const url = docUrl.value.trim();
  try {
    await api.put('/config', { googleDocUrl: url || null });
  } catch (error) {
    console.error('Failed to save doc URL:', error);
  }
}

function openDoc() {
  if (config.googleDocUrl) {
    window.open(config.googleDocUrl, '_blank');
  }
}

function openLink(url) {
  window.open(url, '_blank');
}

async function toggleLinkVisibility(linkId, hidden) {
  try {
    await api.put(`/links/${linkId}`, { hidden });
  } catch (error) {
    console.error('Failed to toggle link visibility:', error);
  }
}

async function deleteLink(linkId) {
  if (!confirm('Delete this link?')) return;
  try {
    await api.delete(`/links/${linkId}`);
  } catch (error) {
    console.error('Failed to delete link:', error);
  }
}

async function deleteSection(sectionId) {
  if (!confirm('Delete this section and all its links?')) return;
  try {
    await api.delete(`/links/sections/${sectionId}`);
  } catch (error) {
    console.error('Failed to delete section:', error);
  }
}

function editSection(sectionId) {
  const section = links.find(s => s.id === sectionId);
  if (!section) return;

  const newName = prompt('Enter new section name:', section.name);
  if (newName && newName.trim()) {
    api.put(`/links/sections/${sectionId}`, { name: newName.trim() });
  }
}

// Modal Handlers
function showAddLinkModal() {
  if (links.length === 0) {
    alert('Please create a section first');
    return;
  }
  updateSectionSelect();
  document.getElementById('linkName').value = '';
  document.getElementById('linkUrl').value = '';
  addLinkModal.classList.remove('hidden');
}

function hideAddLinkModal() {
  addLinkModal.classList.add('hidden');
}

async function saveLink() {
  const name = document.getElementById('linkName').value.trim();
  const url = document.getElementById('linkUrl').value.trim();
  const sectionId = document.getElementById('linkSection').value;

  if (!name || !url) {
    alert('Please fill in all fields');
    return;
  }

  try {
    await api.post(`/links/sections/${sectionId}/links`, { name, url });
    hideAddLinkModal();
  } catch (error) {
    console.error('Failed to save link:', error);
  }
}

function showAddSectionModal() {
  document.getElementById('sectionName').value = '';
  addSectionModal.classList.remove('hidden');
}

function hideAddSectionModal() {
  addSectionModal.classList.add('hidden');
}

async function saveSection() {
  const name = document.getElementById('sectionName').value.trim();
  if (!name) {
    alert('Please enter a section name');
    return;
  }

  try {
    await api.post('/links/sections', { name });
    hideAddSectionModal();
  } catch (error) {
    console.error('Failed to save section:', error);
  }
}

// Collapsible Sections
function initCollapsibleSections() {
  const toggles = document.querySelectorAll('.section-toggle');

  toggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      // Don't toggle if clicking on action buttons
      if (e.target.closest('.icon-btn-small')) {
        return;
      }

      const targetId = toggle.getAttribute('data-target');
      const content = document.getElementById(targetId);

      if (content) {
        content.classList.toggle('collapsed');

        // Update chevron rotation
        const chevron = toggle.querySelector('.chevron');
        if (chevron) {
          if (content.classList.contains('collapsed')) {
            chevron.style.transform = 'rotate(-90deg)';
          } else {
            chevron.style.transform = 'rotate(0deg)';
          }
        }
      }
    });
  });

  // Initialize chevron states
  document.querySelectorAll('.section-content').forEach(content => {
    const toggle = document.querySelector(`[data-target="${content.id}"]`);
    if (toggle) {
      const chevron = toggle.querySelector('.chevron');
      if (chevron && content.classList.contains('collapsed')) {
        chevron.style.transform = 'rotate(-90deg)';
      }
    }
  });
}

// Auto-expanding textarea
function initAutoExpandTextarea() {
  const textarea = notesInput;
  if (!textarea) return;

  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
  });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  connectWebSocket();
  initCollapsibleSections();
  initAutoExpandTextarea();

  // Doc URL
  docUrl.addEventListener('change', saveDocUrl);
  docUrl.addEventListener('blur', saveDocUrl);
  openDocBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openDoc();
  });

  // Notes
  notesInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      queueNote();
    }
  });
  clearBtn.addEventListener('click', () => {
    notesInput.value = '';
    notesInput.style.height = 'auto';
    notesInput.focus();
  });
  clearProcessedBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearProcessed();
  });

  // Quick Links Modals
  addLinkBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showAddLinkModal();
  });
  addSectionBtn.addEventListener('click', showAddSectionModal);

  document.getElementById('cancelLinkBtn').addEventListener('click', hideAddLinkModal);
  document.getElementById('saveLinkBtn').addEventListener('click', saveLink);
  document.getElementById('cancelSectionBtn').addEventListener('click', hideAddSectionModal);
  document.getElementById('saveSectionBtn').addEventListener('click', saveSection);

  // Close modals on outside click
  addLinkModal.addEventListener('click', (e) => {
    if (e.target === addLinkModal) hideAddLinkModal();
  });
  addSectionModal.addEventListener('click', (e) => {
    if (e.target === addSectionModal) hideAddSectionModal();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideAddLinkModal();
      hideAddSectionModal();
    }
  });
});

// Expose functions for inline handlers
window.deleteNote = deleteNote;
window.deleteLink = deleteLink;
window.deleteSection = deleteSection;
window.editSection = editSection;
window.toggleLinkVisibility = toggleLinkVisibility;
window.openLink = openLink;
