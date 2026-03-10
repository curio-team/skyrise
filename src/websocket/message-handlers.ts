import WebSocket from 'ws';
import { connectionManager } from './connection-manager';
import { getDatabase } from '../database/db';
import { levelConfig } from '../config/levelConfig';
import { getHandler } from '../level-handlers';
import type { ServerContext, LevelDefinition } from '../level-handlers/base-handler';

function sanitizeLevel(level: LevelDefinition): Record<string, unknown> {
  const handler = getHandler(level.type ?? 'static');
  const clientConfig = handler && level.handlerConfig
    ? handler.getClientConfig(level.handlerConfig)
    : {};
  const html = level.renderHtml ? level.renderHtml(clientConfig) : undefined;
  const { handlerConfig: _raw, validate: _v, renderHtml: _r, ...rest } = level as unknown as Record<string, unknown>;
  void _raw; void _v; void _r;
  return { ...rest, handlerConfig: clientConfig, ...(html !== undefined ? { html } : {}) };
}

export interface WebSocketMessage {
  type: string;
  data?: any;
}

export function handleMessage(ws: WebSocket, message: string): void {
  try {
    const parsedMessage: WebSocketMessage = JSON.parse(message);

    switch (parsedMessage.type) {
      case 'complete_level':
        handleCompleteLevel(ws, parsedMessage.data);
        break;
      case 'kick_student':
        handleKickStudent(ws, parsedMessage.data);
        break;
      case 'submit_answer':
        handleSubmitAnswer(ws, parsedMessage.data);
        break;
      case 'button_clicked':
        handleButtonClicked(ws, parsedMessage.data);
        break;
      case 'hold_start':
      case 'hold_end':
        handleHoldEvent(ws, parsedMessage.type as 'hold_start' | 'hold_end', parsedMessage.data);
        break;
      case 'request_room_state':
        handleRequestRoomState(ws);
        break;
      case 'ping':
        handlePing(ws);
        break;
      default:
        console.warn(`Unknown message type: ${parsedMessage.type}`);
        sendError(ws, `Unknown message type: ${parsedMessage.type}`);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendError(ws, 'Invalid message format');
  }
}

function handleCompleteLevel(ws: WebSocket, data: any): void {
  const clientInfo = connectionManager.getClientInfo(ws);
  if (!clientInfo) {
    sendError(ws, 'Client not registered');
    return;
  }

  if (!clientInfo.isTeacher) {
    sendError(ws, 'Only teachers can complete levels');
    return;
  }

  const { studentId, levelId } = data;
  if (!studentId || !levelId) {
    sendError(ws, 'Missing studentId or levelId');
    return;
  }

  const db = getDatabase();

  try {
    // Validate student belongs to the room
    const student = db.getStudentById(studentId);
    if (!student || student.room_id !== db.getRoomByCode(clientInfo.roomCode)?.id) {
      sendError(ws, 'Invalid student');
      return;
    }

    // Validate level exists
    const level = levelConfig.getLevelById(levelId);
    if (!level) {
      sendError(ws, 'Invalid level');
      return;
    }

    // Check if already completed
    if (db.hasCompletedLevel(studentId, levelId)) {
      sendError(ws, 'Level already completed');
      return;
    }

    // Validate level order (can only complete current level)
    const currentLevel = db.getCurrentLevel(studentId);
    if (levelId !== currentLevel) {
      sendError(ws, `Student must complete level ${currentLevel} first`);
      return;
    }

    // Mark level as complete
    db.addProgress(studentId, levelId);

    // Add rewards to inventory
    level.rewards.forEach(reward => {
      db.addInventoryItem(studentId, reward);
    });

    // Get updated student data
    const updatedStudent = db.getStudentWithProgress(studentId);

    // Broadcast to all clients in the room
    connectionManager.broadcastToRoom(clientInfo.roomCode, {
      type: 'level_completed',
      data: {
        studentId,
        levelId,
        student: updatedStudent,
        rewards: level.rewards
      }
    });

    console.log(`Level ${levelId} completed for student ${studentId}`);
  } catch (error) {
    console.error('Error completing level:', error);
    sendError(ws, 'Failed to complete level');
  }
}

// ---------------------------------------------------------------------------
// Shared completion logic used by all auto-check handlers
// ---------------------------------------------------------------------------

function completeLevelForStudent(
  ws: WebSocket,
  roomCode: string,
  studentId: number,
  levelId: number,
): boolean {
  const db = getDatabase();

  const student = db.getStudentById(studentId);
  const room = db.getRoomByCode(roomCode);
  if (!student || !room || student.room_id !== room.id) {
    sendError(ws, 'Invalid student');
    return false;
  }

  const level = levelConfig.getLevelById(levelId);
  if (!level) {
    sendError(ws, 'Invalid level');
    return false;
  }

  if (db.hasCompletedLevel(studentId, levelId)) {
    sendError(ws, 'Level already completed');
    return false;
  }

  const currentLevel = db.getCurrentLevel(studentId);
  if (levelId !== currentLevel) {
    sendError(ws, `Student must complete level ${currentLevel} first`);
    return false;
  }

  db.addProgress(studentId, levelId);
  level.rewards.forEach((reward) => db.addInventoryItem(studentId, reward));

  const updatedStudent = db.getStudentWithProgress(studentId);
  connectionManager.broadcastToRoom(roomCode, {
    type: 'level_completed',
    data: { studentId, levelId, student: updatedStudent, rewards: level.rewards },
  });

  console.log(`Level ${levelId} auto-completed for student ${studentId}`);
  return true;
}

// ---------------------------------------------------------------------------
// Auto-check handlers (student-initiated)
// ---------------------------------------------------------------------------

/**
 * Handles multiple_choice and open_input submissions.
 * Expected payload: { levelId: number, submission: <handler-specific object> }
 */
function handleSubmitAnswer(ws: WebSocket, data: any): void {
  const clientInfo = connectionManager.getClientInfo(ws);
  if (!clientInfo) {
    sendError(ws, 'Client not registered');
    return;
  }

  if (clientInfo.isTeacher) {
    sendError(ws, 'Teachers cannot submit answers');
    return;
  }

  const studentId = clientInfo.studentId;
  if (!studentId) {
    sendError(ws, 'Student ID not found in session');
    return;
  }

  const levelId: number = typeof data?.levelId === 'number' ? data.levelId : parseInt(data?.levelId);
  if (!levelId || isNaN(levelId)) {
    sendError(ws, 'Missing or invalid levelId');
    return;
  }

  const level = levelConfig.getLevelById(levelId);
  if (!level) {
    sendError(ws, 'Invalid level');
    return;
  }

  const handler = getHandler(level.type);
  if (!handler) {
    sendError(ws, `No handler registered for level type '${level.type}'`);
    return;
  }

  const db = getDatabase();
  const context: ServerContext = {
    db,
    connectionManager,
    roomCode: clientInfo.roomCode,
    studentId,
  };

  // A level-level validate() overrides the handler's built-in validation.
  const result = level.validate
    ? level.validate(data?.submission ?? {}, context)
    : handler.validate(data?.submission ?? {}, level.handlerConfig ?? {}, context);
  if (!result.success) {
    connectionManager.sendToClient(ws, {
      type: 'answer_rejected',
      data: { levelId, message: result.message ?? 'Incorrect answer.' },
    });
    return;
  }

  completeLevelForStudent(ws, clientInfo.roomCode, studentId, levelId);
}

/**
 * Handles click_button submissions.
 * Expected payload: { levelId: number }
 */
function handleButtonClicked(ws: WebSocket, data: any): void {
  const clientInfo = connectionManager.getClientInfo(ws);
  if (!clientInfo) {
    sendError(ws, 'Client not registered');
    return;
  }

  if (clientInfo.isTeacher) {
    sendError(ws, 'Teachers cannot submit button clicks');
    return;
  }

  const studentId = clientInfo.studentId;
  if (!studentId) {
    sendError(ws, 'Student ID not found in session');
    return;
  }

  const levelId: number = typeof data?.levelId === 'number' ? data.levelId : parseInt(data?.levelId);
  if (!levelId || isNaN(levelId)) {
    sendError(ws, 'Missing or invalid levelId');
    return;
  }

  const level = levelConfig.getLevelById(levelId);
  if (!level) {
    sendError(ws, 'Invalid level');
    return;
  }

  const handler = getHandler(level.type);
  if (!handler) {
    sendError(ws, `No handler registered for level type '${level.type}'`);
    return;
  }

  const result = handler.validate({ clicked: true }, level.handlerConfig ?? {}, {
    db: getDatabase(),
    connectionManager,
    roomCode: clientInfo.roomCode,
    studentId,
  });
  if (!result.success) {
    sendError(ws, result.message ?? 'Click not accepted.');
    return;
  }

  completeLevelForStudent(ws, clientInfo.roomCode, studentId, levelId);
}

/**
 * Routes hold_start / hold_end events to the level's handler.
 * Expected payload: { levelId: number }
 */
function handleHoldEvent(ws: WebSocket, eventType: 'hold_start' | 'hold_end', data: any): void {
  const clientInfo = connectionManager.getClientInfo(ws);
  if (!clientInfo || clientInfo.isTeacher) return;

  const studentId = clientInfo.studentId;
  if (!studentId) return;

  const levelId: number = typeof data?.levelId === 'number' ? data.levelId : parseInt(data?.levelId);
  if (!levelId || isNaN(levelId)) return;

  const level = levelConfig.getLevelById(levelId);
  if (!level) return;

  const handler = getHandler(level.type);
  if (!handler?.handleEvent) return;

  const context: ServerContext = {
    db: getDatabase(),
    connectionManager,
    roomCode: clientInfo.roomCode,
    studentId,
  };

  handler.handleEvent(eventType, { levelId }, level.handlerConfig ?? {}, context);
}

function handleKickStudent(ws: WebSocket, data: any): void {
  const clientInfo = connectionManager.getClientInfo(ws);
  if (!clientInfo) {
    sendError(ws, 'Client not registered');
    return;
  }

  if (!clientInfo.isTeacher) {
    sendError(ws, 'Only teachers can kick students');
    return;
  }

  const studentId: number = typeof data?.studentId === 'number' ? data.studentId : parseInt(data?.studentId);
  if (!studentId || isNaN(studentId)) {
    sendError(ws, 'Missing or invalid studentId');
    return;
  }

  const db = getDatabase();

  try {
    const room = db.getRoomByCode(clientInfo.roomCode);
    if (!room) {
      sendError(ws, 'Room not found');
      return;
    }

    const student = db.getStudentById(studentId);
    if (!student || student.room_id !== room.id) {
      sendError(ws, 'Student not found in this room');
      return;
    }

    // Notify the kicked student before removing them
    connectionManager.sendToStudent(clientInfo.roomCode, studentId, {
      type: 'kicked',
      data: { message: 'You have been removed from the room by the teacher.' }
    });

    // Close the student's WebSocket connection
    const roomClients = connectionManager.getRoomClients(clientInfo.roomCode);
    roomClients.forEach(clientWs => {
      const info = connectionManager.getClientInfo(clientWs);
      if (info && info.studentId === studentId) {
        clientWs.close(1008, 'Kicked by teacher');
      }
    });

    // Remove student from the database
    db.deleteStudent(studentId);

    // Broadcast removal to the rest of the room
    connectionManager.broadcastToRoom(clientInfo.roomCode, {
      type: 'student_kicked',
      data: { studentId }
    });

    console.log(`Student ${studentId} kicked from room ${clientInfo.roomCode}`);
  } catch (error) {
    console.error('Error kicking student:', error);
    sendError(ws, 'Failed to kick student');
  }
}

function handleRequestRoomState(ws: WebSocket): void {
  const clientInfo = connectionManager.getClientInfo(ws);
  if (!clientInfo) {
    sendError(ws, 'Client not registered');
    return;
  }

  const db = getDatabase();

  try {
    const room = db.getRoomByCode(clientInfo.roomCode);
    if (!room) {
      sendError(ws, 'Room not found');
      return;
    }

    const students = db.getAllStudentsWithProgress(room.id);
    const levels = levelConfig.getAllLevels().map(sanitizeLevel);

    connectionManager.sendToClient(ws, {
      type: 'room_state',
      data: {
        roomCode: clientInfo.roomCode,
        students,
        levels,
        totalLevels: levelConfig.getTotalLevels()
      }
    });
  } catch (error) {
    console.error('Error getting room state:', error);
    sendError(ws, 'Failed to get room state');
  }
}

function handlePing(ws: WebSocket): void {
  connectionManager.updatePing(ws);
  connectionManager.sendToClient(ws, { type: 'pong' });
}

function sendError(ws: WebSocket, message: string): void {
  connectionManager.sendToClient(ws, {
    type: 'error',
    data: { message }
  });
}

export function handleConnection(ws: WebSocket, roomCode: string, isTeacher: boolean, studentId?: number): void {
  connectionManager.addClient(ws, roomCode, isTeacher, studentId);

  // Send initial room state
  handleRequestRoomState(ws);

  // Notify others in the room
  if (!isTeacher && studentId) {
    const db = getDatabase();
    const student = db.getStudentWithProgress(studentId);

    connectionManager.broadcastToRoom(roomCode, {
      type: 'student_joined',
      data: { student }
    }, ws);
  }

  // Set up message handler
  ws.on('message', (data: WebSocket.Data) => {
    handleMessage(ws, data.toString());
  });

  // Handle pong responses
  ws.on('pong', () => {
    connectionManager.updatePing(ws);
  });

  // Handle disconnection
  ws.on('close', () => {
    const clientInfo = connectionManager.getClientInfo(ws);
    if (clientInfo && !clientInfo.isTeacher && clientInfo.studentId) {
      connectionManager.broadcastToRoom(clientInfo.roomCode, {
        type: 'student_disconnected',
        data: { studentId: clientInfo.studentId }
      });
    }
    connectionManager.removeClient(ws);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    connectionManager.removeClient(ws);
  });
}
