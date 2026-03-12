import type { DatabaseService } from '../database/db';
import type { ConnectionManager } from '../websocket/connection-manager';

export interface LevelHandlerResult {
  success: boolean;
  message?: string;
}

/** Full server context passed to every validate and handleEvent call. */
export interface ServerContext {
  db: DatabaseService;
  connectionManager: ConnectionManager;
  roomCode: string;
  studentId: number;
}

/**
 * A level definition — the shape of every entry in levels.ts.
 *
 * The optional `validate` function lets a level override the handler's built-in
 * validation with arbitrary server-side logic. When present it is called instead
 * of the handler's own validate().
 *
 * The optional `dynamicRewards` function computes per-student rewards at
 * completion time (e.g. assigning unique puzzle pieces). When present it
 * overrides the static `rewards` array for reward assignment only.
 *
 * Set `communal: true` so the teacher can complete the level for all students
 * at once via the `complete_communal_level` message.
 *
 * Set `roomWide: true` (requires `communal: true`) to record a room-level
 * completion so that students who reach this level later are auto-advanced.
 */
export interface LevelDefinition {
  id: number;
  type: string;
  title: string;
  description: string;
  rewards?: string[];
  /** If true, teacher can complete this level for all currently-on-it students at once. */
  communal?: boolean;
  /** If true (and communal), room-wide completion is persisted so late-joining students auto-skip. */
  roomWide?: boolean;
  handlerConfig?: Record<string, unknown>;
  validate?(submission: unknown, context: ServerContext): LevelHandlerResult;
  /** Overrides the static `rewards` array when assigning rewards to a specific student. */
  dynamicRewards?(context: ServerContext): string[];
  /** Returns HTML string rendered into the student UI for this level.
   *  Receives the already-sanitised client config (no secret fields). */
  renderHtml?(clientConfig: Record<string, unknown>): string;
}

/**
 * Base interface for all level handlers.
 *
 * TConfig  – the handler-specific config stored in levels.ts under `handlerConfig`
 * TSubmission – the payload the client sends when submitting this level type
 *
 * To add a new handler:
 *   1. Create a class implementing LevelHandler<YourConfig, YourSubmission>
 *   2. Register it in src/level-handlers/index.ts via registerCustomHandler()
 */
export interface LevelHandler<TConfig = unknown, TSubmission = unknown> {
  /** Must match the `type` field in levels.ts */
  readonly type: string;

  /**
   * Server-side validation of the student's submission.
   * Called by the websocket message handler before marking a level complete.
   * Skipped when the level definition has its own `validate` function.
   */
  validate(submission: TSubmission, config: TConfig, context: ServerContext): LevelHandlerResult;

  /**
   * Returns the subset of config that is safe to send to the client.
   * Never include correct answers or secret validation rules here.
   */
  getClientConfig(config: TConfig): Record<string, unknown>;

  /**
   * Handle real-time events sent by students (e.g. hold_start, hold_end).
   * Implement this on handlers that need persistent per-room state.
   */
  handleEvent?(eventType: string, data: unknown, config: TConfig, context: ServerContext): void;
}
