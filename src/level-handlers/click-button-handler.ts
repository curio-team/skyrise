import { LevelHandler, LevelHandlerResult } from './base-handler';

export interface ClickButtonConfig {
  buttonLabel: string;
  /**
   * Optional JavaScript snippet injected into the student's page to make the
   * button harder to click (e.g. it jumps away on hover).
   * The server still accepts the click once the student manages to hit it.
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

  /** The injectScript is intentionally included so the client can set up the trick. */
  getClientConfig(config: ClickButtonConfig): Record<string, unknown> {
    return {
      buttonLabel: config.buttonLabel,
      injectScript: config.injectScript ?? null,
    };
  }
}
