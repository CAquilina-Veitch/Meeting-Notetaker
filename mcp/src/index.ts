#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";

// Data file paths - relative to the project root
const DATA_DIR = path.join(__dirname, "../../server/data");
const NOTES_FILE = path.join(DATA_DIR, "notes-queue.json");
const LINKS_FILE = path.join(DATA_DIR, "quick-links.json");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

// Types
interface Note {
  id: string;
  text: string;
  status: "pending" | "processing" | "processed";
  createdAt: string;
  processedAt: string | null;
  result: ProcessingResult | null;
}

interface ProcessingResult {
  addedTo?: string[];
  formattedAs?: string[];
  error?: string;
}

interface NotesData {
  notes: Note[];
}

interface LinkSection {
  id: string;
  name: string;
  order: number;
  links: Link[];
}

interface Link {
  id: string;
  name: string;
  url: string;
  hidden: boolean;
  createdAt: string;
}

interface Config {
  googleDocId: string | null;
  googleDocUrl: string | null;
  lastUpdated: string | null;
}

// File operations
function readNotes(): NotesData {
  try {
    const data = fs.readFileSync(NOTES_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return { notes: [] };
  }
}

function writeNotes(data: NotesData): void {
  fs.writeFileSync(NOTES_FILE, JSON.stringify(data, null, 2));
}

function readLinks(): LinkSection[] {
  try {
    const data = fs.readFileSync(LINKS_FILE, "utf8");
    return JSON.parse(data).sections || [];
  } catch {
    return [];
  }
}

function readConfig(): Config {
  try {
    const data = fs.readFileSync(CONFIG_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return { googleDocId: null, googleDocUrl: null, lastUpdated: null };
  }
}

// Define available tools
const tools: Tool[] = [
  {
    name: "get_pending_notes",
    description:
      "Get all meeting notes that are waiting to be processed. Returns notes with status 'pending'.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_all_notes",
    description:
      "Get all meeting notes including pending, processing, and processed notes.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description:
            "Filter by status: 'pending', 'processing', or 'processed'. If not specified, returns all notes.",
          enum: ["pending", "processing", "processed"],
        },
        limit: {
          type: "number",
          description: "Maximum number of notes to return. Default is 50.",
        },
      },
      required: [],
    },
  },
  {
    name: "mark_note_processing",
    description:
      "Mark a note as currently being processed. Use this before starting to process a note.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: {
          type: "string",
          description: "The ID of the note to mark as processing",
        },
      },
      required: ["noteId"],
    },
  },
  {
    name: "mark_note_processed",
    description:
      "Mark a note as processed and record what was done with it. Call this after successfully adding content to the Google Doc.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: {
          type: "string",
          description: "The ID of the note to mark as processed",
        },
        result: {
          type: "object",
          description: "Details about what was done with the note",
          properties: {
            addedTo: {
              type: "array",
              items: { type: "string" },
              description:
                "List of section names where content was added (e.g., ['Timeline', 'Action Items'])",
            },
            formattedAs: {
              type: "array",
              items: { type: "string" },
              description:
                "How the content was formatted (e.g., ['- Deadline: Friday', '- [ ] Confirm deadline'])",
            },
            error: {
              type: "string",
              description:
                "Error message if processing failed (optional)",
            },
          },
        },
      },
      required: ["noteId", "result"],
    },
  },
  {
    name: "get_quick_links",
    description:
      "Get all quick links organized by sections. Useful for finding relevant reference documents.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_target_document",
    description:
      "Get the currently configured Google Doc ID and URL where notes should be inserted.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "suggest_relevant_link",
    description:
      "Given a topic or keyword, suggest which quick link might be relevant. Returns matching links based on name similarity.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description:
            "The topic or keyword to search for in quick links",
        },
      },
      required: ["topic"],
    },
  },
];

// Tool handlers
async function handleGetPendingNotes(): Promise<string> {
  const data = readNotes();
  const pending = data.notes.filter((n) => n.status === "pending");

  if (pending.length === 0) {
    return JSON.stringify({
      count: 0,
      notes: [],
      message: "No pending notes to process",
    });
  }

  return JSON.stringify({
    count: pending.length,
    notes: pending.map((n) => ({
      id: n.id,
      text: n.text,
      createdAt: n.createdAt,
    })),
  });
}

async function handleGetAllNotes(args: {
  status?: string;
  limit?: number;
}): Promise<string> {
  const data = readNotes();
  let notes = data.notes;

  if (args.status) {
    notes = notes.filter((n) => n.status === args.status);
  }

  const limit = args.limit || 50;
  notes = notes.slice(0, limit);

  return JSON.stringify({
    count: notes.length,
    notes: notes,
  });
}

async function handleMarkNoteProcessing(args: {
  noteId: string;
}): Promise<string> {
  const data = readNotes();
  const note = data.notes.find((n) => n.id === args.noteId);

  if (!note) {
    return JSON.stringify({
      success: false,
      error: `Note with ID ${args.noteId} not found`,
    });
  }

  note.status = "processing";
  writeNotes(data);

  return JSON.stringify({
    success: true,
    note: {
      id: note.id,
      text: note.text,
      status: note.status,
    },
  });
}

async function handleMarkNoteProcessed(args: {
  noteId: string;
  result: ProcessingResult;
}): Promise<string> {
  const data = readNotes();
  const note = data.notes.find((n) => n.id === args.noteId);

  if (!note) {
    return JSON.stringify({
      success: false,
      error: `Note with ID ${args.noteId} not found`,
    });
  }

  note.status = "processed";
  note.processedAt = new Date().toISOString();
  note.result = args.result;
  writeNotes(data);

  return JSON.stringify({
    success: true,
    note: {
      id: note.id,
      text: note.text,
      status: note.status,
      result: note.result,
    },
  });
}

async function handleGetQuickLinks(): Promise<string> {
  const sections = readLinks();

  if (sections.length === 0) {
    return JSON.stringify({
      count: 0,
      sections: [],
      message: "No quick links configured",
    });
  }

  return JSON.stringify({
    count: sections.reduce((sum, s) => sum + s.links.length, 0),
    sections: sections.map((s) => ({
      name: s.name,
      links: s.links
        .filter((l) => !l.hidden)
        .map((l) => ({
          name: l.name,
          url: l.url,
        })),
    })),
  });
}

async function handleGetTargetDocument(): Promise<string> {
  const config = readConfig();

  if (!config.googleDocId) {
    return JSON.stringify({
      configured: false,
      message:
        "No Google Doc configured. Please set a document URL in the webapp.",
    });
  }

  return JSON.stringify({
    configured: true,
    documentId: config.googleDocId,
    documentUrl: config.googleDocUrl,
    lastUpdated: config.lastUpdated,
  });
}

async function handleSuggestRelevantLink(args: {
  topic: string;
}): Promise<string> {
  const sections = readLinks();
  const topicLower = args.topic.toLowerCase();
  const matches: Array<{ name: string; url: string; section: string }> = [];

  for (const section of sections) {
    for (const link of section.links) {
      if (link.hidden) continue;

      const nameLower = link.name.toLowerCase();
      if (
        nameLower.includes(topicLower) ||
        topicLower.includes(nameLower) ||
        link.url.toLowerCase().includes(topicLower)
      ) {
        matches.push({
          name: link.name,
          url: link.url,
          section: section.name,
        });
      }
    }
  }

  if (matches.length === 0) {
    return JSON.stringify({
      found: false,
      message: `No quick links found matching topic: ${args.topic}`,
    });
  }

  return JSON.stringify({
    found: true,
    matches: matches,
  });
}

// Create and run the server
const server = new Server(
  {
    name: "meeting-notetaker-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: string;

    switch (name) {
      case "get_pending_notes":
        result = await handleGetPendingNotes();
        break;
      case "get_all_notes":
        result = await handleGetAllNotes(args as { status?: string; limit?: number });
        break;
      case "mark_note_processing":
        result = await handleMarkNoteProcessing(args as { noteId: string });
        break;
      case "mark_note_processed":
        result = await handleMarkNoteProcessed(
          args as { noteId: string; result: ProcessingResult }
        );
        break;
      case "get_quick_links":
        result = await handleGetQuickLinks();
        break;
      case "get_target_document":
        result = await handleGetTargetDocument();
        break;
      case "suggest_relevant_link":
        result = await handleSuggestRelevantLink(args as { topic: string });
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: errorMessage }),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Meeting Notetaker MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
