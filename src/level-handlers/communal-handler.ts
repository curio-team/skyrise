import { LevelHandler, LevelHandlerResult } from './base-handler';

/**
 * Handler for communal levels.
 * Students cannot self-complete these levels; the teacher completes them
 * for all students at once via `complete_communal_level`.
 */
export class CommunalHandler implements LevelHandler<Record<string, never>, never> {
  readonly type = 'communal';

  validate(_submission: never, _config: Record<string, never>): LevelHandlerResult {
    return { success: false, message: 'Communal levels are completed by the teacher for the whole class.' };
  }

  getClientConfig(_config: Record<string, never>): Record<string, unknown> {
    return {};
  }
}
