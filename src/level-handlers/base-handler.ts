export interface LevelHandlerResult {
  success: boolean;
  message?: string;
}

/** Runtime context injected by the websocket layer during validation. */
export interface ValidationContext {
  /** Display names of all students currently in the room. */
  playerNames: string[];
}

/**
 * Base interface for all level handlers.
 *
 * TConfig  – the handler-specific config stored in levels.json under `handlerConfig`
 * TSubmission – the payload the client sends when submitting this level type
 *
 * To add a new handler:
 *   1. Create a class implementing LevelHandler<YourConfig, YourSubmission>
 *   2. Register it in src/level-handlers/index.ts via registerCustomHandler()
 */
export interface LevelHandler<TConfig = unknown, TSubmission = unknown> {
  /** Must match the `type` field in levels.json */
  readonly type: string;

  /**
   * Server-side validation of the student's submission.
   * Called by the websocket message handler before marking a level complete.
   */
  validate(submission: TSubmission, config: TConfig, context?: ValidationContext): LevelHandlerResult;

  /**
   * Returns the subset of config that is safe to send to the client.
   * Never include correct answers or secret validation rules here.
   */
  getClientConfig(config: TConfig): Record<string, unknown>;
}
