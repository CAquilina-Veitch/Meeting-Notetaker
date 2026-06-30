# Meeting Notetaker

A local webapp + MCP server system that lets you jot quick meeting notes, which Claude Code processes and inserts into the appropriate sections of a Google Doc.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            YOUR COMPUTER                                │
│                                                                         │
│  ┌──────────────────┐                      ┌──────────────────────────┐ │
│  │    Browser       │   HTTP/WebSocket     │   Local Node Server      │ │
│  │                  │◄───────────────────► │   (localhost:3000)       │ │
│  │  - Webapp UI     │                      │                          │ │
│  │  - Doc link      │                      │  - Serves webapp         │ │
│  │  - Quick links   │                      │  - Manages notes queue   │ │
│  │  - Notes input   │                      │  - Quick links storage   │ │
│  └──────────────────┘                      └────────────┬─────────────┘ │
│                                                         │               │
│                                                         │ File I/O      │
│                                                         ▼               │
│                                            ┌──────────────────────────┐ │
│                                            │  notes-queue.json        │ │
│                                            │  quick-links.json        │ │
│  ┌──────────────────┐                      │  config.json             │ │
│  │  Google Docs     │                      └────────────┬─────────────┘ │
│  │  (separate tab)  │                                   │               │
│  └──────────────────┘                                   │ MCP (stdio)   │
│           ▲                                             ▼               │
│           │                                ┌──────────────────────────┐ │
│           │    Google Docs API             │     Claude Code          │ │
│           └────────────────────────────────│                          │ │
│                                            │  MCP Servers:            │ │
│                                            │  - meeting-notetaker     │ │
│                                            │  - google-docs           │ │
│                                            └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Features

- **Quick Notes Input**: Type meeting notes with Ctrl+Enter to queue them
- **Real-time Updates**: WebSocket connection for live queue status
- **Quick Links Panel**: Organize reference documents by sections
- **Google Docs Integration**: Claude Code processes notes and inserts them into the correct document sections
- **MCP Tools**: Full suite of tools for queue management and document operations

## Quick Start

### 1. Install Dependencies

```bash
cd Meeting-Notetaker
npm install
```

### 2. Build the MCP Server

```bash
cd mcp
npm run build
cd ..
```

### 3. Start the Server

**Windows:**
```bash
start.bat
```

**Unix/Mac:**
```bash
chmod +x start.sh
./start.sh
```

**Or manually:**
```bash
npm start
```

### 4. Open the Webapp

Navigate to http://localhost:3000 in your browser.

### 5. Configure Claude Code

Add the Meeting Notetaker MCP to your Claude Code configuration:

```json
{
  "mcpServers": {
    "meeting-notetaker": {
      "command": "node",
      "args": ["C:/path/to/Meeting-Notetaker/mcp/dist/index.js"]
    },
    "google-docs": {
      "command": "node",
      "args": ["C:/path/to/Google-Docs-MCP/dist/index.js"]
    }
  }
}
```

## Usage

### In the Webapp

1. **Set Google Doc URL**: Paste your meeting notes document URL
2. **Add Quick Links**: Organize reference documents by sections
3. **Type Notes**: Write quick notes during meetings
4. **Queue Notes**: Press Ctrl+Enter to add notes to the queue

### With Claude Code

Tell Claude Code to process your meeting notes:

```
Process my meeting notes
```

Claude Code will:
1. Fetch pending notes from the queue
2. Analyze each note to determine where it belongs
3. Get the document outline
4. Insert formatted content under the appropriate headings
5. Mark notes as processed

## MCP Tools

### Meeting Notetaker MCP

| Tool | Description |
|------|-------------|
| `get_pending_notes` | Get all notes waiting to be processed |
| `get_all_notes` | Get all notes with optional status filter |
| `mark_note_processing` | Mark a note as currently being processed |
| `mark_note_processed` | Mark a note as done and record what was added |
| `get_quick_links` | Get organized quick links by section |
| `get_target_document` | Get the configured Google Doc ID |
| `suggest_relevant_link` | Find quick links matching a topic |

### Google Docs MCP (New Tools)

| Tool | Description |
|------|-------------|
| `get_document_outline` | Get headings with their positions |
| `insert_under_heading` | Insert content under a specific heading |
| `append_to_section` | Smart append that creates sections if missing |

## API Endpoints

### Notes

- `GET /api/notes` - Get all notes
- `GET /api/notes/pending` - Get pending notes only
- `POST /api/notes` - Add a note to queue
- `PUT /api/notes/:id` - Update note status
- `DELETE /api/notes/:id` - Remove a note
- `DELETE /api/notes/processed/all` - Clear all processed notes

### Quick Links

- `GET /api/links` - Get all sections and links
- `POST /api/links/sections` - Create a new section
- `PUT /api/links/sections/:id` - Update a section
- `DELETE /api/links/sections/:id` - Delete a section
- `POST /api/links/sections/:sectionId/links` - Add a link
- `PUT /api/links/:id` - Update a link
- `DELETE /api/links/:id` - Delete a link
- `PUT /api/links/reorder/sections` - Reorder sections

### Config

- `GET /api/config` - Get current configuration
- `PUT /api/config` - Update configuration (Google Doc URL)

## File Structure

```
Meeting-Notetaker/
├── webapp/
│   ├── index.html      # Main UI
│   ├── styles.css      # Styling
│   └── app.js          # Frontend logic
│
├── server/
│   ├── index.js        # Express + WebSocket server
│   ├── routes/
│   │   ├── notes.js    # Notes API
│   │   ├── links.js    # Quick links API
│   │   └── config.js   # Config API
│   └── data/
│       ├── notes-queue.json
│       ├── quick-links.json
│       └── config.json
│
├── mcp/
│   ├── src/
│   │   └── index.ts    # MCP server
│   ├── package.json
│   └── tsconfig.json
│
├── start.bat           # Windows launcher
├── start.sh            # Unix launcher
├── package.json        # Root package
└── README.md
```

## Example Workflow

1. **During a meeting**, open the webapp and type notes:
   - "john said deadline is friday"
   - "need to review the proposal by EOD"
   - "action item: schedule follow-up meeting"

2. **After the meeting**, tell Claude Code:
   ```
   Process my meeting notes
   ```

3. **Claude Code processes each note**:
   - Analyzes content to determine category
   - Finds or creates appropriate sections in your doc
   - Formats and inserts content

4. **Your Google Doc is updated** with properly organized notes:
   - Timeline section: "**Deadline:** Friday (per John)"
   - Action Items section: "- [ ] Review proposal by EOD"
   - Follow-up section: "- Schedule follow-up meeting"

## Development

### Running in Development Mode

```bash
npm run dev
```

This starts the server with file watching enabled.

### Building the MCP Server

```bash
cd mcp
npm run build
```

### Watching MCP Changes

```bash
cd mcp
npm run dev
```

## Requirements

- Node.js 18+
- Google Docs MCP configured and authenticated
- Claude Code with MCP support

## License

MIT
