import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export interface Room {
  id: number;
  code: string;
  created_at: number;
  last_activity: number;
}

export interface RoomWithCount extends Room {
  student_count: number;
}

export interface Student {
  id: number;
  room_id: number;
  name: string;
  color: string;
  joined_at: number;
}

export interface Progress {
  id: number;
  student_id: number;
  level_id: number;
  completed_at: number;
}

export interface InventoryItem {
  id: number;
  student_id: number;
  item_id: string;
  acquired_at: number;
}

export interface StudentWithProgress extends Student {
  current_level: number;
  completed_levels: number[];
  inventory: string[];
}

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('foreign_keys = ON');
    this.initialize();
  }

  private initialize(): void {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);
    console.log('Database initialized successfully');
  }

  // Room operations
  createRoom(code: string): Room {
    const now = Date.now();
    const stmt = this.db.prepare(
      'INSERT INTO rooms (code, created_at, last_activity) VALUES (?, ?, ?)'
    );
    const result = stmt.run(code, now, now);
    return {
      id: result.lastInsertRowid as number,
      code,
      created_at: now,
      last_activity: now
    };
  }

  getRoomByCode(code: string): Room | undefined {
    const stmt = this.db.prepare('SELECT * FROM rooms WHERE code = ?');
    return stmt.get(code) as Room | undefined;
  }

  updateRoomActivity(roomId: number): void {
    const stmt = this.db.prepare('UPDATE rooms SET last_activity = ? WHERE id = ?');
    stmt.run(Date.now(), roomId);
  }

  deleteOldRooms(olderThanMs: number): number {
    const cutoff = Date.now() - olderThanMs;
    const stmt = this.db.prepare('DELETE FROM rooms WHERE last_activity < ?');
    const result = stmt.run(cutoff);
    return result.changes;
  }

  getAllRooms(): RoomWithCount[] {
    const stmt = this.db.prepare(`
      SELECT r.*, COUNT(s.id) as student_count
      FROM rooms r
      LEFT JOIN students s ON s.room_id = r.id
      GROUP BY r.id
      ORDER BY r.last_activity DESC
    `);
    return stmt.all() as RoomWithCount[];
  }

  deleteRoom(roomId: number): void {
    const stmt = this.db.prepare('DELETE FROM rooms WHERE id = ?');
    stmt.run(roomId);
  }

  // Student operations
  addStudent(roomId: number, name: string, color: string): Student {
    const now = Date.now();
    const stmt = this.db.prepare(
      'INSERT INTO students (room_id, name, color, joined_at) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(roomId, name, color, now);
    return {
      id: result.lastInsertRowid as number,
      room_id: roomId,
      name,
      color,
      joined_at: now
    };
  }

  getStudentById(studentId: number): Student | undefined {
    const stmt = this.db.prepare('SELECT * FROM students WHERE id = ?');
    return stmt.get(studentId) as Student | undefined;
  }

  getStudentsByRoom(roomId: number): Student[] {
    const stmt = this.db.prepare('SELECT * FROM students WHERE room_id = ? ORDER BY joined_at');
    return stmt.all(roomId) as Student[];
  }

  getStudentByRoomAndName(roomId: number, name: string): Student | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM students WHERE room_id = ? AND LOWER(name) = LOWER(?)'
    );
    return stmt.get(roomId, name) as Student | undefined;
  }

  // Progress operations
  addProgress(studentId: number, levelId: number): Progress {
    const now = Date.now();
    const stmt = this.db.prepare(
      'INSERT INTO progress (student_id, level_id, completed_at) VALUES (?, ?, ?)'
    );
    const result = stmt.run(studentId, levelId, now);
    return {
      id: result.lastInsertRowid as number,
      student_id: studentId,
      level_id: levelId,
      completed_at: now
    };
  }

  getStudentProgress(studentId: number): Progress[] {
    const stmt = this.db.prepare(
      'SELECT * FROM progress WHERE student_id = ? ORDER BY level_id'
    );
    return stmt.all(studentId) as Progress[];
  }

  hasCompletedLevel(studentId: number, levelId: number): boolean {
    const stmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM progress WHERE student_id = ? AND level_id = ?'
    );
    const result = stmt.get(studentId, levelId) as { count: number };
    return result.count > 0;
  }

  getCurrentLevel(studentId: number): number {
    const progress = this.getStudentProgress(studentId);
    if (progress.length === 0) return 1;

    // Find the highest completed level
    const maxLevel = Math.max(...progress.map(p => p.level_id));
    return maxLevel + 1; // Next level to complete
  }

  // Inventory operations
  addInventoryItem(studentId: number, itemId: string): InventoryItem {
    const now = Date.now();
    const stmt = this.db.prepare(
      'INSERT INTO inventory (student_id, item_id, acquired_at) VALUES (?, ?, ?)'
    );
    const result = stmt.run(studentId, itemId, now);
    return {
      id: result.lastInsertRowid as number,
      student_id: studentId,
      item_id: itemId,
      acquired_at: now
    };
  }

  getStudentInventory(studentId: number): InventoryItem[] {
    const stmt = this.db.prepare(
      'SELECT * FROM inventory WHERE student_id = ? ORDER BY acquired_at'
    );
    return stmt.all(studentId) as InventoryItem[];
  }

  deleteStudent(studentId: number): void {
    const stmt = this.db.prepare('DELETE FROM students WHERE id = ?');
    stmt.run(studentId);
  }

  // Room-level (communal) progress operations
  markRoomLevelComplete(roomId: number, levelId: number): void {
    const now = Date.now();
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO room_progress (room_id, level_id, completed_at) VALUES (?, ?, ?)'
    );
    stmt.run(roomId, levelId, now);
  }

  hasRoomCompletedLevel(roomId: number, levelId: number): boolean {
    const stmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM room_progress WHERE room_id = ? AND level_id = ?'
    );
    const result = stmt.get(roomId, levelId) as { count: number };
    return result.count > 0;
  }

  // Combined operations
  getStudentWithProgress(studentId: number): StudentWithProgress | undefined {
    const student = this.getStudentById(studentId);
    if (!student) return undefined;

    const progress = this.getStudentProgress(studentId);
    const inventory = this.getStudentInventory(studentId);

    return {
      ...student,
      current_level: this.getCurrentLevel(studentId),
      completed_levels: progress.map(p => p.level_id),
      inventory: inventory.map(i => i.item_id)
    };
  }

  getAllStudentsWithProgress(roomId: number): StudentWithProgress[] {
    const students = this.getStudentsByRoom(roomId);
    return students.map(student => {
      const progress = this.getStudentProgress(student.id);
      const inventory = this.getStudentInventory(student.id);

      return {
        ...student,
        current_level: this.getCurrentLevel(student.id),
        completed_levels: progress.map(p => p.level_id),
        inventory: inventory.map(i => i.item_id)
      };
    });
  }

  // Utility
  generateRoomCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code: string;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      attempts++;

      if (attempts >= maxAttempts) {
        throw new Error('Failed to generate unique room code');
      }
    } while (this.getRoomByCode(code));

    return code;
  }

  close(): void {
    this.db.close();
  }
}

// Singleton instance
let dbInstance: DatabaseService | null = null;

export function initializeDatabase(dbPath: string): DatabaseService {
  if (!dbInstance) {
    dbInstance = new DatabaseService(dbPath);
  }
  return dbInstance;
}

export function getDatabase(): DatabaseService {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return dbInstance;
}
