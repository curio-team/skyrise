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

4. Start the server:

   ```bash
   npm start
   ```

5. Open your browser to `http://localhost:3000`

## Development

For development with auto-rebuild:

```bash
# Terminal 1: Watch TypeScript compilation
npm run watch

# Terminal 2: Start the server (restart manually after changes)
npm start
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

### Environment Variables

Create a `.env` file in the root directory (see `.env.example`):

```env
PORT=3000
DB_PATH=./skyrise.db
```

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

## Project Structure

```txt
skyrise/
├── src/
│   ├── config/
│   │   ├── levels.json          # Level definitions
│   │   └── levelConfig.ts       # Level configuration loader
│   ├── database/
│   │   ├── schema.sql           # Database schema
│   │   └── db.ts                # Database service layer
│   ├── websocket/
│   │   ├── connection-manager.ts    # WebSocket connection management
│   │   └── message-handlers.ts     # Message routing and business logic
│   └── server.ts                # Main Express server
├── public/
│   ├── css/
│   │   └── styles.css           # Shared styles
│   ├── js/
│   │   ├── skyline-renderer.js      # Canvas-based skyline visualization
│   │   ├── teacher-client.js        # Teacher WebSocket client
│   │   └── student-client.js        # Student WebSocket client
│   ├── index.html               # Landing page
│   ├── teacher.html             # Teacher dashboard
│   └── student.html             # Student view
├── package.json
├── tsconfig.json
└── README.md
```

## API Endpoints

### HTTP REST API

- `POST /api/rooms` - Create a new room
- `POST /api/rooms/:code/join` - Join a room as a student
- `GET /api/rooms/:code/config` - Get level configuration
- `GET /api/rooms/:code/state` - Get current room state

### WebSocket Protocol

Connect to: `ws://localhost:3000/ws?room=ROOMCODE&role=teacher|student&studentId=123`

**Client → Server Messages:**

```json
{"type": "complete_level", "data": {"studentId": 1, "levelId": 2}}
{"type": "request_room_state", "data": {}}
{"type": "ping", "data": {}}
```

**Server → Client Messages:**

```json
{"type": "room_state", "data": {"students": [...], "levels": [...], ...}}
{"type": "student_joined", "data": {"student": {...}}}
{"type": "level_completed", "data": {"studentId": 1, "levelId": 2, "student": {...}, "rewards": [...]}}
{"type": "student_disconnected", "data": {"studentId": 1}}
{"type": "error", "data": {"message": "Error description"}}
{"type": "pong", "data": {}}
```

## Features in Detail

### Real-time Skyline Visualization

The skyline is rendered using HTML5 Canvas with:

- Each student represented as a colored building
- Building height proportional to completed levels
- Interactive selection by clicking buildings
- Automatic scaling for large classes (30+ students)
- Simple window pattern for visual appeal

### Progress Tracking

- Students start at Level 1
- Must complete levels in order
- Can rejoin rooms and maintain progress
- Progress persists in SQLite database

### Room Management

- Rooms automatically clean up after 24 hours of inactivity
- Unique 6-digit alphanumeric codes
- Multiple rooms can run simultaneously
- Students can reconnect if disconnected

### Connection Health

- Automatic ping/pong heartbeat every 30 seconds
- Client-side reconnection with exponential backoff
- Visual connection status indicators
- Stale connection cleanup after 60 seconds

## Troubleshooting

**Build errors**: Ensure TypeScript v5+ is installed

**WebSocket connection fails**: Check firewall settings and ensure port 3000 is accessible

**Database locked**: Only one server instance can access the SQLite database at a time

**Students can't join**: Verify room code is correct (case-insensitive) and room exists
