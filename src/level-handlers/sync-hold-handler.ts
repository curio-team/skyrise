import { LevelHandler, LevelHandlerResult, ServerContext } from './base-handler';
import { levelConfig } from '../config/levelConfig';

export interface SyncHoldConfig {
  buttonLabel: string;
  /**
   * All students must hold simultaneously for this many milliseconds before
   * the level completes. Set to 0 for instant completion. Default: 1000.
   */
  holdDurationMs?: number;
}

export class SyncHoldHandler implements LevelHandler<SyncHoldConfig, unknown> {
  readonly type = 'sync_hold';

  /** roomCode:levelId → set of studentIds currently holding */
  private holdState = new Map<string, Set<number>>();
  /** roomCode:levelId → pending completion timer */
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  private stateKey(roomCode: string, levelId: number): string {
    return `${roomCode}:${levelId}`;
  }

  private clearTimer(key: string): void {
    const t = this.timers.get(key);
    if (t !== undefined) {
      clearTimeout(t);
      this.timers.delete(key);
    }
  }

  // sync_hold levels are completed via handleEvent, not submit_answer.
  validate(_submission: unknown, _config: SyncHoldConfig): LevelHandlerResult {
    return {
      success: false,
      message: 'Dit level wordt voltooid door tegelijk de knop ingedrukt te houden met alle spelers.',
    };
  }

  getClientConfig(config: SyncHoldConfig): Record<string, unknown> {
    return {
      buttonLabel: config.buttonLabel,
      holdDurationMs: config.holdDurationMs ?? 1000,
    };
  }

  handleEvent(
    eventType: string,
    data: unknown,
    config: SyncHoldConfig,
    context: ServerContext,
  ): void {
    const { levelId } = data as { levelId: number };
    const key = this.stateKey(context.roomCode, levelId);

    if (eventType === 'hold_start') {
      if (!this.holdState.has(key)) this.holdState.set(key, new Set());
      this.holdState.get(key)!.add(context.studentId);
    } else if (eventType === 'hold_end') {
      this.holdState.get(key)?.delete(context.studentId);
      this.clearTimer(key);
    }

    const holders = this.holdState.get(key) ?? new Set<number>();
    const room = context.db.getRoomByCode(context.roomCode);
    if (!room) return;

    const students = context.db.getStudentsByRoom(room.id);
    const studentsOnLevel = students.filter(
      (s) => context.db.getCurrentLevel(s.id) === levelId,
    );
    const requiredCount = studentsOnLevel.length;

    // Broadcast live status so the client can show "3/5 players holding"
    context.connectionManager.broadcastToRoom(context.roomCode, {
      type: 'hold_status',
      data: { levelId, holdersCount: holders.size, requiredCount },
    });

    if (requiredCount > 0 && holders.size >= requiredCount) {
      const duration = config.holdDurationMs ?? 1000;
      if (duration <= 0) {
        this.completeForAll(levelId, studentsOnLevel, context);
      } else {
        this.clearTimer(key);
        // Snapshot which students must still be holding when the timer fires
        const requiredIds = new Set(studentsOnLevel.map((s) => s.id));
        const timer = setTimeout(() => {
          const current = this.holdState.get(key) ?? new Set<number>();
          const stillAll = [...requiredIds].every((id) => current.has(id));
          if (stillAll) this.completeForAll(levelId, studentsOnLevel, context);
        }, duration);
        this.timers.set(key, timer);
      }
    }
  }

  private completeForAll(
    levelId: number,
    studentsOnLevel: Array<{ id: number }>,
    context: ServerContext,
  ): void {
    const level = levelConfig.getLevelById(levelId);
    if (!level) return;

    for (const student of studentsOnLevel) {
      if (context.db.hasCompletedLevel(student.id, levelId)) continue;
      context.db.addProgress(student.id, levelId);
      level.rewards.forEach((reward) => context.db.addInventoryItem(student.id, reward));
      const updated = context.db.getStudentWithProgress(student.id);
      context.connectionManager.broadcastToRoom(context.roomCode, {
        type: 'level_completed',
        data: { studentId: student.id, levelId, student: updated, rewards: level.rewards },
      });
    }

    const key = this.stateKey(context.roomCode, levelId);
    this.holdState.delete(key);
    this.clearTimer(key);
  }
}
