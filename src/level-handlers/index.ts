/**
 * Level handler registry.
 *
 * All built-in handlers are registered automatically on import.
 * To add a custom handler, call registerCustomHandler() from your own module.
 *
 * Usage:
 *   import { getHandler } from './level-handlers';
 *   const handler = getHandler(level.type);   // returns undefined if unknown
 */

import { LevelHandler } from './base-handler';
import { StaticHandler } from './static-handler';
import { MultipleChoiceHandler } from './multiple-choice-handler';
import { OpenInputHandler } from './open-input-handler';
import { ClickButtonHandler } from './click-button-handler';
import { SyncHoldHandler } from './sync-hold-handler';
import { CommunalHandler } from './communal-handler';

export type { LevelHandler, LevelHandlerResult } from './base-handler';
export type { MultipleChoiceConfig, MultipleChoiceSubmission } from './multiple-choice-handler';
export type { OpenInputConfig, OpenInputSubmission, ValidationRule } from './open-input-handler';
export type { ClickButtonConfig, ClickButtonSubmission } from './click-button-handler';

// ---------------------------------------------------------------------------
// Internal registry
// ---------------------------------------------------------------------------

const registry = new Map<string, LevelHandler>();

function register(handler: LevelHandler): void {
  if (registry.has(handler.type)) {
    throw new Error(`Level handler '${handler.type}' is already registered.`);
  }
  registry.set(handler.type, handler);
}

// ---------------------------------------------------------------------------
// Built-in handlers
// ---------------------------------------------------------------------------

register(new StaticHandler());
register(new MultipleChoiceHandler());
register(new OpenInputHandler());
register(new ClickButtonHandler());
register(new SyncHoldHandler());
register(new CommunalHandler());

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up a handler by its type string.
 * Returns undefined when the type is not registered.
 */
export function getHandler(type: string): LevelHandler | undefined {
  return registry.get(type);
}

/**
 * Register a custom handler at runtime.
 * Throws if a handler with the same type is already registered.
 */
export function registerCustomHandler(handler: LevelHandler): void {
  register(handler);
}

/** Returns all registered handler type strings (useful for validation). */
export function getRegisteredTypes(): string[] {
  return Array.from(registry.keys());
}
