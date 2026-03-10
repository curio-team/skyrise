# 🏙️ Skyrise - Educational City Builder

A collaborative educational game where students progress through learning levels while building a virtual city together. Each student's progress is visualized as a building in a shared skyline.

## Features

- **Real-time Collaboration**: WebSocket-based instant updates across all connected clients
- **Teacher Dashboard**: Create rooms, manage students, and track progress with an interactive skyline visualization
- **Student View**: Join rooms, complete assignments, and watch your building grow
- **Progress Tracking**: Visual progress through levels with reward system
- **Inventory System**: Collect items/badges as students complete levels
- **Configurable Levels**: JSON-based level configuration for easy customization

## Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **WebSockets**: Native WebSocket (ws library)
- **Database**: SQLite (better-sqlite3)
- **Frontend**: Vanilla HTML/CSS/JavaScript with Canvas API

## Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the TypeScript code:

   ```bash
   npm run build
   ```

4. Copy the example environment file and edit as needed:

   ```bash
   cp .env.example .env
   ```

5. Start the server:

   ```bash
   npm start
   ```

6. Open your browser to `http://localhost:3000`

## Development

For development with auto-rebuild:

```bash
npm run dev
```

## Usage

### For Teachers

1. Navigate to the Teacher Dashboard
2. Click "Create New Room" to generate a 6-digit room code
3. Share the room code with students
4. Watch the skyline as students join
5. Select a student and mark their levels as complete when they finish assignments

### For Students

1. Navigate to the Student View
2. Enter the room code provided by your teacher
3. Enter your name
4. Read the current level assignment
5. Complete the assignment in real life
6. Wait for your teacher to mark it complete
7. Watch your building grow and collect rewards!

## Configuration

### Level Configuration

Edit `src/config/levels.json` to customize levels:

```json
[
  {
    "id": 1,
    "title": "Level Title",
    "description": "Brief description",
    "assignmentText": "Detailed assignment instructions for students",
    "rewards": ["item1", "item2"]
  }
]
```

After editing, rebuild and restart:

```bash
npm run build
npm start
```
