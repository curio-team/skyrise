import { LevelHandler, LevelHandlerResult } from './base-handler';

/** Static levels have no automatic validation — the teacher approves them manually. */
export class StaticHandler implements LevelHandler<Record<string, never>, never> {
  readonly type = 'static';

  // Students cannot self-submit static levels; teacher uses complete_level instead.
  validate(_submission: never, _config: Record<string, never>): LevelHandlerResult {
    return { success: false, message: 'Static levels must be approved by the teacher.' };
  }

  getClientConfig(_config: Record<string, never>): Record<string, unknown> {
    return {};
  }
}
