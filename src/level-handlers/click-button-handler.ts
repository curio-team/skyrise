import { LevelHandler, LevelHandlerResult } from './base-handler';

/**
 * Named client-side behavior for the click-button level type.
 *
 * Built-in values understood by the student client:
 *   - "none"  – plain button, no tricks (default)
 *   - "dodge" – button moves out of the way when the cursor approaches
 *
 * New behaviors can be added to the BUTTON_BEHAVIORS registry in
 * student-client.js without touching server code.
 */
export type ClickButtonBehavior = 'none' | 'dodge' | string;

export interface ClickButtonConfig {
  buttonLabel: string;
  /**
   * Named behavior applied to the button on the client.
   * Prefer this over injectScript for built-in trick types.
   */
  behavior?: ClickButtonBehavior;
  /**
   * Optional JavaScript snippet injected into the student's page to make the
   * button harder to click (e.g. it jumps away on hover).
   * The server still accepts the click once the student manages to hit it.
   * Use `behavior` instead when one of the built-in named behaviors suffices.
   */
  injectScript?: string;
}

export interface ClickButtonSubmission {
  clicked: true;
}

export class ClickButtonHandler implements LevelHandler<ClickButtonConfig, ClickButtonSubmission> {
  readonly type = 'click_button';

  validate(submission: ClickButtonSubmission, _config: ClickButtonConfig): LevelHandlerResult {
    if (submission.clicked !== true) {
      return { success: false, message: 'Button was not clicked.' };
    }
    return { success: true };
  }

  /** The injectScript and behavior are intentionally included so the client can set up the trick. */
  getClientConfig(config: ClickButtonConfig): Record<string, unknown> {
    return {
      buttonLabel: config.buttonLabel,
      behavior: config.behavior ?? 'none',
      injectScript: config.injectScript ?? null,
    };
  }
}
