@echo off
echo =============================================
echo    Meeting Notetaker - Starting System
echo =============================================
echo.

cd /d "%~dp0"

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

REM Build MCP server if needed
if not exist "mcp\dist" (
    echo Building MCP server...
    cd mcp
    call npm run build
    cd ..
    echo.
)

echo Starting server on http://localhost:3000
echo.

REM Start the server in a new minimized window
start "Meeting Notetaker Server" /min cmd /c "npm start"

REM Wait a moment for server to start
timeout /t 2 /nobreak > nul

REM Open the webapp in default browser
start http://localhost:3000

echo.
echo =============================================
echo    Starting Claude Code Watch Mode
echo =============================================
echo.
echo Claude Code will now watch for meeting notes
echo and automatically process them into your Google Doc.
echo.
echo Make sure you have:
echo   1. Set your Google Doc URL in the webapp
echo   2. The Google Docs MCP server configured
echo.

REM Launch Claude Code in a new window with the watch prompt
REM Using --setting-sources to skip user settings (avoids IDE hooks)
start "Claude Code - Meeting Watcher" cmd /k cd /d "%~dp0" ^&^& claude --setting-sources project,local "You are in Meeting Notetaker watch mode. MCP tools available: get_pending_notes, mark_note_processed, get_target_document. Google Docs MCP tools: append_text, insert_text. Loop: 1) Call get_pending_notes, 2) For each note, insert into Google Doc then call mark_note_processed, 3) Wait 20 seconds, 4) Repeat. Start now - call get_pending_notes."

echo.
echo Claude Code is now watching for meeting notes!
echo You can close this window.
echo.
pause
