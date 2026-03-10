import { LevelHandler, LevelHandlerResult } from './base-handler';

// ---------------------------------------------------------------------------
// Validation rules — add new rule shapes here to extend the system
// ---------------------------------------------------------------------------

interface ContainsAllRule {
  type: 'contains_all';
  /** All of these strings must appear in the answer (case-insensitive). */
  keywords: string[];
}

interface ContainsAnyRule {
  type: 'contains_any';
  /** At least one of these strings must appear in the answer (case-insensitive). */
  keywords: string[];
}

interface MinLengthRule {
  type: 'min_length';
  length: number;
}

interface ExactRule {
  type: 'exact';
  answer: string;
  caseSensitive?: boolean;
}

export type ValidationRule = ContainsAllRule | ContainsAnyRule | MinLengthRule | ExactRule;

// ---------------------------------------------------------------------------

export interface OpenInputConfig {
  prompt: string;
  placeholder?: string;
  /** Server-side validation rule. Never sent to clients. */
  validation: ValidationRule;
}

export interface OpenInputSubmission {
  answer: string;
}

export class OpenInputHandler implements LevelHandler<OpenInputConfig, OpenInputSubmission> {
  readonly type = 'open_input';

  validate(submission: OpenInputSubmission, config: OpenInputConfig): LevelHandlerResult {
    const answer = (submission.answer ?? '').trim();

    if (!answer) {
      return { success: false, message: 'Answer cannot be empty.' };
    }

    const rule = config.validation;

    switch (rule.type) {
      case 'contains_all': {
        const missing = rule.keywords.filter(
          (kw) => !answer.toLowerCase().includes(kw.toLowerCase()),
        );
        if (missing.length > 0) {
          return { success: false, message: 'Your answer is missing some required content. Keep trying!' };
        }
        break;
      }

      case 'contains_any': {
        const found = rule.keywords.some((kw) =>
          answer.toLowerCase().includes(kw.toLowerCase()),
        );
        if (!found) {
          return { success: false, message: "Your answer doesn't seem to address the topic. Try again!" };
        }
        break;
      }

      case 'min_length': {
        if (answer.length < rule.length) {
          return {
            success: false,
            message: `Your answer needs to be at least ${rule.length} characters. You're at ${answer.length}.`,
          };
        }
        break;
      }

      case 'exact': {
        const submitted = rule.caseSensitive ? answer : answer.toLowerCase();
        const expected = rule.caseSensitive ? rule.answer : rule.answer.toLowerCase();
        if (submitted !== expected) {
          return { success: false, message: 'Incorrect answer — try again!' };
        }
        break;
      }
    }

    return { success: true };
  }

  /** Returns prompt and placeholder only — validation rules are never exposed. */
  getClientConfig(config: OpenInputConfig): Record<string, unknown> {
    return {
      prompt: config.prompt,
      placeholder: config.placeholder ?? '',
    };
  }
}
