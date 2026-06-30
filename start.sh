#!/bin/bash

echo "============================================="
echo "   Meeting Notetaker - Starting Server"
echo "============================================="
echo

cd "$(dirname "$0")"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo
fi

# Build MCP server if needed
if [ ! -d "mcp/dist" ]; then
    echo "Building MCP server..."
    cd mcp
    npm run build
    cd ..
    echo
fi

echo "Starting server on http://localhost:3000"
echo "Press Ctrl+C to stop"
echo

npm start
