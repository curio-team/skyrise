import type { LevelDefinition } from '../level-handlers/base-handler';
import levelsArray from './levels';

// Re-export so the rest of the codebase can use either name.
export type { LevelDefinition };
/** @deprecated Use LevelDefinition instead. */
export type Level = LevelDefinition;

class LevelConfig {
  private levels: LevelDefinition[];

  constructor() {
    this.levels = [...levelsArray].sort((a, b) => a.id - b.id);
    console.log(`Loaded ${this.levels.length} levels from configuration`);
  }

  getAllLevels(): LevelDefinition[] {
    return this.levels;
  }

  getLevelById(id: number): LevelDefinition | undefined {
    return this.levels.find((level) => level.id === id);
  }

  getTotalLevels(): number {
    return this.levels.length;
  }

  isValidLevel(id: number): boolean {
    return id >= 1 && id <= this.levels.length;
  }
}

// Singleton instance
export const levelConfig = new LevelConfig();
