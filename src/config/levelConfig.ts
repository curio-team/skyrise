import fs from 'fs';
import path from 'path';

export interface Level {
  id: number;
  /** Determines which handler processes this level. Defaults to 'static'. */
  type: string;
  title: string;
  description: string;
  assignmentText: string;
  rewards: string[];
  /** Handler-specific configuration (e.g. choices for multiple_choice). */
  handlerConfig?: Record<string, unknown>;
}

class LevelConfig {
  private levels: Level[] = [];

  constructor() {
    this.loadLevels();
  }

  private loadLevels(): void {
    try {
      const configPath = path.join(__dirname, '..', 'config', 'levels.json');
      const data = fs.readFileSync(configPath, 'utf-8');
      this.levels = JSON.parse(data);
      
      // Validate levels
      if (!Array.isArray(this.levels) || this.levels.length === 0) {
        throw new Error('Levels must be a non-empty array');
      }

      // Ensure levels are sorted by ID
      this.levels.sort((a, b) => a.id - b.id);

      console.log(`Loaded ${this.levels.length} levels from configuration`);
    } catch (error) {
      console.error('Failed to load levels configuration:', error);
      throw error;
    }
  }

  getAllLevels(): Level[] {
    return this.levels;
  }

  getLevelById(id: number): Level | undefined {
    return this.levels.find(level => level.id === id);
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
