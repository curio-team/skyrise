import WebSocket from 'ws';

export interface ClientInfo {
  ws: WebSocket;
  roomCode: string;
  studentId?: number;
  isTeacher: boolean;
  lastPing: number;
}

export class ConnectionManager {
  private clients: Map<WebSocket, ClientInfo> = new Map();
  private roomClients: Map<string, Set<WebSocket>> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startPingInterval();
  }

  addClient(ws: WebSocket, roomCode: string, isTeacher: boolean, studentId?: number): void {
    const clientInfo: ClientInfo = {
      ws,
      roomCode,
      studentId,
      isTeacher,
      lastPing: Date.now()
    };

    this.clients.set(ws, clientInfo);

    // Add to room clients
    if (!this.roomClients.has(roomCode)) {
      this.roomClients.set(roomCode, new Set());
    }
    this.roomClients.get(roomCode)!.add(ws);

    console.log(`Client added to room ${roomCode} (${isTeacher ? 'teacher' : 'student'})`);
  }

  removeClient(ws: WebSocket): void {
    const clientInfo = this.clients.get(ws);
    if (!clientInfo) return;

    // Remove from room clients
    const roomClients = this.roomClients.get(clientInfo.roomCode);
    if (roomClients) {
      roomClients.delete(ws);
      if (roomClients.size === 0) {
        this.roomClients.delete(clientInfo.roomCode);
      }
    }

    this.clients.delete(ws);
    console.log(`Client removed from room ${clientInfo.roomCode}`);
  }

  getClientInfo(ws: WebSocket): ClientInfo | undefined {
    return this.clients.get(ws);
  }

  getRoomClients(roomCode: string): Set<WebSocket> {
    return this.roomClients.get(roomCode) || new Set();
  }

  broadcastToRoom(roomCode: string, message: any, excludeWs?: WebSocket): void {
    const clients = this.getRoomClients(roomCode);
    const messageStr = JSON.stringify(message);

    clients.forEach(clientWs => {
      if (clientWs !== excludeWs && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(messageStr);
      }
    });
  }

  sendToClient(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  sendToStudent(roomCode: string, studentId: number, message: any): void {
    const clients = this.getRoomClients(roomCode);
    const messageStr = JSON.stringify(message);

    clients.forEach(ws => {
      const clientInfo = this.clients.get(ws);
      if (clientInfo && clientInfo.studentId === studentId && ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }

  sendToTeachers(roomCode: string, message: any): void {
    const clients = this.getRoomClients(roomCode);
    const messageStr = JSON.stringify(message);

    clients.forEach(ws => {
      const clientInfo = this.clients.get(ws);
      if (clientInfo && clientInfo.isTeacher && ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }

  updatePing(ws: WebSocket): void {
    const clientInfo = this.clients.get(ws);
    if (clientInfo) {
      clientInfo.lastPing = Date.now();
    }
  }

  private startPingInterval(): void {
    // Send ping every 30 seconds and check for stale connections
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 60 seconds

      this.clients.forEach((clientInfo, ws) => {
        if (now - clientInfo.lastPing > timeout) {
          console.log('Closing stale connection');
          ws.close();
        } else if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });
    }, 30000);
  }

  cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.clients.forEach((_, ws) => {
      ws.close();
    });

    this.clients.clear();
    this.roomClients.clear();
  }

  getStats(): { totalClients: number; totalRooms: number; roomSizes: Record<string, number> } {
    const roomSizes: Record<string, number> = {};
    this.roomClients.forEach((clients, roomCode) => {
      roomSizes[roomCode] = clients.size;
    });

    return {
      totalClients: this.clients.size,
      totalRooms: this.roomClients.size,
      roomSizes
    };
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager();
