import { EventEmitter } from 'node:events';
import { StreamingLLMInvoke } from '../../interfaces/LLMInvoke';
import { Logger, AGENT_COLOR, RESET } from '../logging/debug-logger';

export enum ChunkType {
    Input = 'input',
    LlmOutput = 'llmOutput',
    ToolOutput = 'toolOutput',
    AgentOutput = 'agentOutput',
    Error = 'error',
    Data = 'data'
}

export interface Chunk {
    type: ChunkType;
    content: string;
    processed: boolean;
    messageId?: string;
}

export interface Task {
    id: string;
    agent_name: string;
    input: any;
    parent_task_id: string | null;
    scratchpad: Chunk[];
    retryCount: number;
}

export abstract class Tool {
    abstract readonly name: string;
    abstract readonly description: string;
    abstract readonly parameters: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
    abstract readonly prompt?: string;
    abstract run(parameters: any): Promise<any>;
}

function parseToolResults(scratchpad: string): Array<any> {
    const startCount = (scratchpad.match(/<\|tool_result\|>/g) || []).length;
    const endCount = (scratchpad.match(/<\|tool_result_end\|>/g) || []).length;
    if (startCount !== endCount) {
        throw new Error("tool result incomplete");
    }
    const toolResultRegex = /<\|tool_result\|>(.*?)<\|tool_result_end\|>/gs;
    const results = [];
    let match;
    while ((match = toolResultRegex.exec(scratchpad)) !== null) {
        const resultData = JSON.parse(match[1]);
        results.push(resultData);
    }
    return results;
}

function parseAgentResults(scratchpad: string): Array<any> {
    const startCount = (scratchpad.match(/<\|agent_result\|>/g) || []).length;
    const endCount = (scratchpad.match(/<\|agent_result_end\|>/g) || []).length;
    if (startCount !== endCount) {
        throw new Error("agent result incomplete");
    }
    const agentResultRegex = /<\|agent_result\|>(.*?)<\|agent_result_end\|>/gs;
    const results = [];
    let match;
    while ((match = agentResultRegex.exec(scratchpad)) !== null) {
        const resultData = JSON.parse(match[1]);
        results.push(resultData);
    }
    return results;
}

export abstract class LLMAgent {
    eventEmitter: EventEmitter;
    public supportsContinuation: boolean = false;
    public tools: Record<string, Tool> = {};
    public registeredAgents: Record<string, LLMAgent> = {};
    protected streamingLLM: StreamingLLMInvoke;
    public fqdn: string;

    constructor(streamingLLM: StreamingLLMInvoke, arena: any) {
        this.streamingLLM = streamingLLM;
        this.eventEmitter = new EventEmitter();
        this.fqdn = `agents.${this.constructor.name}`;
        if (arena) {
            arena.wireAgentEventEmitter(this);
        }
    }

    registerTool(tool: Tool) {
        this.tools[tool.name] = tool;
    }

    registerAgent(agent: LLMAgent) {
        this.registeredAgents[agent.constructor.name] = agent;
    }

    setStreamingLLM(streamingLLM: StreamingLLMInvoke) {
        this.streamingLLM = streamingLLM;
    }

    async run(task: Task): Promise<string> {
        try {
            const prompt = this.buildPrompt(task);
            let response = '';
            if (this.streamingLLM && this.streamingLLM.generateStream) {
                for await (const chunk of this.streamingLLM.generateStream(prompt)) {
                    if (chunk.token) {
                        response += chunk.token;
                        this.eventEmitter.emit('token', chunk.token);
                    }
                    if (chunk.finishReason) {
                        // done
                        break;
                    }
                }
            } else if (this.streamingLLM && (this.streamingLLM as any).generate) {
                response = await (this.streamingLLM as any).generate(prompt);
            } else {
                throw new Error(`No generate method available; streamingLLM is: ${this.streamingLLM}`);
            }
            return this.postProcessResponse(response);
        } catch (error) {
            this.eventEmitter.emit('error', error);
            throw error;
        }
    }

    protected getScratchpadContent(task: Task): string {
        return task.scratchpad.map(c => c.content).join('\n');
    }

    protected getFilteredContents(task: Task, type: ChunkType): string {
        return task.scratchpad.filter(c => c.type === type).map(c => c.content).join('\n');
    }

    protected parseAgentResultsSafe(task: Task, contents: string, addErrorChunk: boolean = false): any[] {
        try {
            return parseAgentResults(contents);
        } catch (e) {
            this.eventEmitter.emit('parseError', { type: 'agentResults', error: e, content: contents });
            if (addErrorChunk) {
                const errorChunk = { type: ChunkType.Error, content: `Parse error in agentResults: ${e}`, processed: true };
                this.addChunk(task, errorChunk);
                return []; // or some default
            } else {
                throw e;
            }
        }
    }

    protected parseToolResultsSafe(task: Task, contents: string, addErrorChunk: boolean = false): any[] {
        try {
            return parseToolResults(contents);
        } catch (e) {
            this.eventEmitter.emit('parseError', { type: 'toolResults', error: e, content: contents });
            if (addErrorChunk) {
                const errorChunk = { type: ChunkType.Error, content: `Parse error in toolResults: ${e}`, processed: true };
                this.addChunk(task, errorChunk);
                return []; // or some default
            } else {
                throw e;
            }
        }
    }

    public addChunk(task: Task, chunk: Chunk): void {
        task.scratchpad.push(chunk);
        this.eventEmitter.emit('chunk', chunk);
        this.eventEmitter.emit(`chunk:${chunk.type}`, chunk);
    }

    protected postProcessResponse(response: string): string {
        return response;
    }

    public writeTaskDataChunk(task: Task, data: any): void {
        if (!this.fqdn) {
            throw new Error('Agent FQDN not set');
        }
        Logger.globalLog(`${AGENT_COLOR}${this.constructor.name}${RESET} writing task data chunk: ${JSON.stringify(data)}`);
        const chunk: Chunk = {
            type: ChunkType.Data,
            content: JSON.stringify({ fqdn: this.fqdn, data }),
            processed: true
        };
        this.addChunk(task, chunk);
    }

    public writeSessionDataChunk(data: any): void {
        if (!this.fqdn) {
            throw new Error('Agent FQDN not set');
        }
        const arena = (this as any).arena;
        if (!arena) {
            throw new Error('Agent not associated with an arena');
        }
        Logger.globalLog(`${AGENT_COLOR}${this.constructor.name}${RESET} writing session data chunk: ${JSON.stringify(data)}`);
        const chunk: Chunk = {
            type: ChunkType.Data,
            content: JSON.stringify({ fqdn: this.fqdn, data }),
            processed: true
        };
        arena.dataChunks.push(chunk);
    }

    public getTaskDataChunks(task: Task): any[] {
        if (!this.fqdn) {
            throw new Error('Agent FQDN not set');
        }
        return task.scratchpad
            .filter((c: Chunk) => c.type === ChunkType.Data)
            .map((c: Chunk) => {
                try {
                    const parsed = JSON.parse(c.content);
                    return parsed.fqdn === this.fqdn ? parsed.data : null;
                } catch (e) {
                    return null;
                }
            })
            .filter((d: any) => d !== null);
    }

    public getSessionDataChunks(): any[] {
        if (!this.fqdn) {
            throw new Error('Agent FQDN not set');
        }
        const arena = (this as any).arena;
        if (!arena) {
            throw new Error('Agent not associated with an arena');
        }
        return arena.dataChunks
            .filter((c: Chunk) => c.type === ChunkType.Data)
            .map((c: Chunk) => {
                try {
                    const parsed = JSON.parse(c.content);
                    return parsed.fqdn === this.fqdn ? parsed.data : null;
                } catch (e) {
                    return null;
                }
            })
            .filter((d: any) => d !== null);
    }

    public getAllDataChunks(task?: Task): any[] {
        const sessionData = this.getSessionDataChunks();
        const taskData = task ? this.getTaskDataChunks(task) : [];
        return [...sessionData, ...taskData];
    }

    abstract buildPrompt(task: Task): string;
}