import WebSocket from 'ws';
import { connectionManager } from './connection-manager';
import { getDatabase } from '../database/db';
import { levelConfig } from '../config/levelConfig';

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
    level. rewards.forEach(reward => {
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
    const levels = levelConfig.getAllLevels();

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
