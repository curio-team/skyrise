import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
import { initializeDatabase, getDatabase } from './database/db';
import { levelConfig } from './config/levelConfig';
import { handleConnection } from './websocket/message-handlers';
import { connectionManager } from './websocket/connection-manager';
import { getHandler } from './level-handlers';
import type { Level } from './config/levelConfig';

/** Strip server-only fields (e.g. correctIndex) before sending a level to clients. */
function sanitizeLevel(level: Level): Record<string, unknown> {
  const handler = getHandler(level.type ?? 'static');
  const clientConfig = handler && level.handlerConfig
    ? handler.getClientConfig(level.handlerConfig)
    : {};
  const html = level.renderHtml ? level.renderHtml(clientConfig) : undefined;
  const { handlerConfig: _raw, validate: _v, renderHtml: _r, ...rest } = level as unknown as Record<string, unknown>;
  void _raw; void _v; void _r;
  return { ...rest, handlerConfig: clientConfig, ...(html !== undefined ? { html } : {}) };
}

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || './skyrise.db';

// Initialize database
initializeDatabase(DB_PATH);
const db = getDatabase();

// Create Express app
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Color palette for students
const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
  '#E63946', '#A8DADC', '#457B9D', '#F1FAEE', '#E76F51',
  '#2A9D8F', '#E9C46A', '#F4A261', '#264653', '#8338EC'
];

function getRandomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

// API Routes

// List all active rooms
app.get('/api/rooms', (req, res) => {
  const teacherCode = process.env.TEACHER_CODE;
  const provided = req.query.teacherCode as string | undefined;
  if (teacherCode && provided !== teacherCode) {
    return res.status(403).json({ success: false, error: 'Invalid teacher code' });
  }
  try {
    const rooms = db.getAllRooms();
    return res.json({ success: true, rooms });
  } catch (error) {
    console.error('Error listing rooms:', error);
    return res.status(500).json({ success: false, error: 'Failed to list rooms' });
  }
});

// Delete a room
app.delete('/api/rooms/:code', (req, res) => {
  const teacherCode = process.env.TEACHER_CODE;
  const provided = req.body.teacherCode as string | undefined;
  if (teacherCode && provided !== teacherCode) {
    return res.status(403).json({ success: false, error: 'Invalid teacher code' });
  }
  try {
    const { code } = req.params;
    const room = db.getRoomByCode(code.toUpperCase());
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    db.deleteRoom(room.id);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting room:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete room' });
  }
});

// Create a new room
app.post('/api/rooms', (req, res) => {
  const teacherCode = process.env.TEACHER_CODE;
  if (teacherCode && req.body.teacherCode !== teacherCode) {
    return res.status(403).json({ success: false, error: 'Invalid teacher code' });
  }
  try {
    const code = db.generateRoomCode();
    const room = db.createRoom(code);
    return res.json({ success: true, roomCode: code, roomId: room.id });
  } catch (error) {
    console.error('Error creating room:', error);
    return res.status(500).json({ success: false, error: 'Failed to create room' });
  }
});

// Join a room
app.post('/api/rooms/:code/join', (req, res) => {
  try {
    const { code } = req.params;
    const name: string = typeof req.body.name === 'string' ? req.body.name.trim() : '';

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const room = db.getRoomByCode(code.toUpperCase());
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Check if student already exists (reconnection)
    let student = db.getStudentByRoomAndName(room.id, name);

    if (!student) {
      // Create new student
      const color = getRandomColor();
      student = db.addStudent(room.id, name, color);
    }

    // Update room activity
    db.updateRoomActivity(room.id);

    return res.json({
      success: true,
      studentId: student.id,
      student: db.getStudentWithProgress(student.id)
    });
  } catch (error) {
    console.error('Error joining room:', error);
    return res.status(500).json({ success: false, error: 'Failed to join room' });
  }
});

// Item definitions
app.get('/api/items', (_req, res) => {
  try {
    const itemsPath = path.join(__dirname, 'config', 'items.json');
    const data = fs.readFileSync(itemsPath, 'utf-8');
    return res.json(JSON.parse(data));
  } catch (error) {
    console.error('Error loading items:', error);
    return res.status(500).json({ success: false, error: 'Failed to load items' });
  }
});

// Get room configuration (levels)
app.get('/api/rooms/:code/config', (req, res) => {
  try {
    const { code } = req.params;
    const room = db.getRoomByCode(code.toUpperCase());

    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    return res.json({
      success: true,
      levels: levelConfig.getAllLevels().map(sanitizeLevel),
      totalLevels: levelConfig.getTotalLevels()
    });
  } catch (error) {
    console.error('Error getting config:', error);
    return res.status(500).json({ success: false, error: 'Failed to get configuration' });
  }
});

// Get room state (for initial load)
app.get('/api/rooms/:code/state', (req, res) => {
  try {
    const { code } = req.params;
    const room = db.getRoomByCode(code.toUpperCase());

    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const students = db.getAllStudentsWithProgress(room.id);

    return res.json({
      success: true,
      roomCode: code.toUpperCase(),
      students,
      levels: levelConfig.getAllLevels().map(sanitizeLevel),
      totalLevels: levelConfig.getTotalLevels()
    });
  } catch (error) {
    console.error('Error getting room state:', error);
    return res.status(500).json({ success: false, error: 'Failed to get room state' });
  }
});

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const roomCode = url.searchParams.get('room')?.toUpperCase();
  const role = url.searchParams.get('role');
  const studentId = url.searchParams.get('studentId');

  if (!roomCode) {
    ws.close(1008, 'Room code required');
    return;
  }

  // Verify room exists
  const room = db.getRoomByCode(roomCode);
  if (!room) {
    ws.close(1008, 'Room not found');
    return;
  }

  const isTeacher = role === 'teacher';
  const studentIdNum = studentId ? parseInt(studentId) : undefined;

  // Verify student if not teacher
  if (!isTeacher) {
    if (!studentIdNum) {
      ws.close(1008, 'Student ID required');
      return;
    }

    const student = db.getStudentById(studentIdNum);
    if (!student || student.room_id !== room.id) {
      ws.close(1008, 'Invalid student');
      return;
    }
  }

  // Handle the connection
  handleConnection(ws, roomCode, isTeacher, studentIdNum);
});

// Cleanup old rooms every hour
setInterval(() => {
  const deleted = db.deleteOldRooms(24 * 60 * 60 * 1000); // 24 hours
  if (deleted > 0) {
    console.log(`Cleaned up ${deleted} old rooms`);
  }
}, 60 * 60 * 1000);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  connectionManager.cleanup();
  server.close(() => {
    db.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  connectionManager.cleanup();
  server.close(() => {
    db.close();
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready at ws://localhost:${PORT}/ws`);
});
