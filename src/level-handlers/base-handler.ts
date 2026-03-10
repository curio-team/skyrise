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
 */
export interface LevelDefinition {
  id: number;
  type: string;
  title: string;
  description: string;
  rewards: string[];
  handlerConfig?: Record<string, unknown>;
  validate?(submission: unknown, context: ServerContext): LevelHandlerResult;
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
