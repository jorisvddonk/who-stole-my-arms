import { readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { LLMAgent } from '../core/LLMAgent';
import { TopLevelAgent } from './TopLevelAgent';
import { ConversationalAgent } from './ConversationalAgent';
import { SimpleAgent } from './SimpleAgent';
import { CombatAgent } from './CombatAgent';
import { MathAgent } from './MathAgent';
import { ErrorAgent } from './ErrorAgent';
import { RPGGameMasterAgent } from './RPGGameMasterAgent';
import { Logger } from '../logging/debug-logger';

export class AgentManager {
  private static instance: AgentManager;
  private agents: Record<string, LLMAgent> = {};
  private initialized = false;

  private constructor() {}

  static getInstance(): AgentManager {
    if (!AgentManager.instance) {
      AgentManager.instance = new AgentManager();
    }
    return AgentManager.instance;
  }

  async init(streamingLLM: any): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    Logger.debugLog('Initializing AgentManager');

    // Load hardcoded agents
    this.agents = {
      'TopLevelAgent': new TopLevelAgent(streamingLLM, null),
      'ConversationalAgent': new ConversationalAgent(streamingLLM, null),
      'SimpleAgent': new SimpleAgent(streamingLLM, null),
      'CombatAgent': new CombatAgent(streamingLLM, null),
      'MathAgent': new MathAgent(streamingLLM, null),
      'ErrorAgent': new ErrorAgent(streamingLLM, null),
      'RPGGameMasterAgent': new RPGGameMasterAgent(streamingLLM, null),
    };

    // Load dynamic agents
    await this.loadDynamicAgents(streamingLLM);

    Logger.debugLog(`AgentManager loaded agents: ${Object.keys(this.agents).join(', ')}`);
  }

  private async loadDynamicAgents(streamingLLM: any): Promise<void> {
    const searchPaths = process.env.WSMA_AGENT_SEARCH_PATH;
    Logger.debugLog(`WSMA_AGENT_SEARCH_PATH: ${searchPaths}`);
    if (!searchPaths) {
      Logger.debugLog('No WSMA_AGENT_SEARCH_PATH set, skipping dynamic agent loading');
      return;
    }

    const paths = searchPaths.split(';').map(p => p.trim()).filter(p => p);
    for (const searchPath of paths) {
      try {
        Logger.debugLog(`Reading directory: ${searchPath}`);
        const files = readdirSync(searchPath);
        Logger.debugLog(`Found files: ${files.join(', ')}`);
        for (const file of files) {
          if (extname(file) === '.ts' || extname(file) === '.js') {
            const filePath = join(searchPath, file);
            Logger.debugLog(`Attempting to load agent from: ${filePath}`);
            try {
              const module = await import(filePath);
              Logger.debugLog(`Imported module from ${filePath}`);
              const AgentClass = module.default;
              if (AgentClass && typeof AgentClass === 'function') {
                Logger.debugLog(`AgentClass ${AgentClass.name} is a function`);
                if (AgentClass.prototype instanceof LLMAgent) {
                  Logger.debugLog(`AgentClass ${AgentClass.name} extends LLMAgent, instantiating`);
                  const instance = new AgentClass(streamingLLM, null);
                  this.agents[AgentClass.name] = instance;
                  Logger.debugLog(`Successfully loaded agent: ${AgentClass.name}`);
                } else {
                  Logger.debugLog(`AgentClass ${AgentClass.name} does not extend LLMAgent`);
                }
              } else {
                Logger.debugLog(`No valid default export in ${filePath}`);
              }
            } catch (e) {
              Logger.debugLog(`Failed to load agent from ${filePath}: ${e}`);
            }
          } else {
            Logger.debugLog(`Skipping non-agent file: ${file}`);
          }
        }
      } catch (e) {
        console.warn(`Failed to read agent search path ${searchPath}: ${e}`);
      }
    }
  }

  getAgents(): Record<string, LLMAgent> {
    return { ...this.agents };
  }

  getAgentNames(): string[] {
    return Object.keys(this.agents);
  }

  getAgent(name: string): LLMAgent | undefined {
    return this.agents[name];
  }
}