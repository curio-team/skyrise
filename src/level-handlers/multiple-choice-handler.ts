import { LevelHandler, LevelHandlerResult } from './base-handler';

export interface MultipleChoiceConfig {
  question: string;
  choices: string[];
  /** Zero-based index into `choices` that is considered correct. Never sent to clients. */
  correctIndex: number;
}

export interface MultipleChoiceSubmission {
  /** Zero-based index of the choice the student selected. */
  selectedIndex: number;
}

export class MultipleChoiceHandler
  implements LevelHandler<MultipleChoiceConfig, MultipleChoiceSubmission> {
  readonly type = 'multiple_choice';

  validate(
    submission: MultipleChoiceSubmission,
    config: MultipleChoiceConfig,
  ): LevelHandlerResult {
    const { selectedIndex } = submission;

    if (selectedIndex === undefined || selectedIndex === null) {
      return { success: false, message: 'No answer selected.' };
    }

    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= config.choices.length) {
      return { success: false, message: 'Invalid selection.' };
    }

    if (selectedIndex !== config.correctIndex) {
      return { success: false, message: 'Incorrect answer — try again!' };
    }

    return { success: true };
  }

  /** Returns question and choices only — correctIndex is never exposed. */
  getClientConfig(config: MultipleChoiceConfig): Record<string, unknown> {
    return {
      question: config.question,
      choices: config.choices,
    };
  }
}
