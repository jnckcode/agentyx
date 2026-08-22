/**
 * @file config-manager.ts
 * @description Manages configuration stored in ~/.agentyx/config.json
 * @purpose Load, update, and persist user credentials, 9router URL, active agent, and session settings.
 * @functions ConfigManager - Class to read/write config, getConfig, updateConfig, resolveDefaults
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface AgentyxConfig {
  NINEROUTER_BASE_URL: string;
  NINEROUTER_API_KEY: string;
  DEFAULT_COMBO: string;
  ACTIVE_SESSION_ID?: string;
  ACTIVE_AGENT: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.agentyx');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: AgentyxConfig = {
  NINEROUTER_BASE_URL: 'http://localhost:3000/v1',
  NINEROUTER_API_KEY: 'sk-9router-default-key',
  DEFAULT_COMBO: 'default-combo',
  ACTIVE_AGENT: 'Full-Team Coding'
};

export class ConfigManager {
  private config: AgentyxConfig;

  constructor() {
    this.ensureDirectoryExists();
    this.config = this.loadConfig();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
  }

  public loadConfig(): AgentyxConfig {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch {
      // Fallback to default if file corrupt or unreadable
    }
    this.saveConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }

  public saveConfig(newConfig: Partial<AgentyxConfig>): AgentyxConfig {
    this.config = { ...this.config, ...newConfig };
    this.ensureDirectoryExists();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf-8');
    return this.config;
  }

  public getConfig(): AgentyxConfig {
    return { ...this.config };
  }

  public updateConfig(key: keyof AgentyxConfig, value: string): AgentyxConfig {
    return this.saveConfig({ [key]: value });
  }

  public getAppDir(): string {
    return CONFIG_DIR;
  }
}

export const configManager = new ConfigManager();
