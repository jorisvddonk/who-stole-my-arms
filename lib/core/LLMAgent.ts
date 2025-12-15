import { EventEmitter } from 'node:events';
import { StreamingLLMInvoke } from '../../interfaces/LLMInvoke';
import { Logger, AGENT_COLOR, TOOL_COLOR, RESET } from '../logging/debug-logger';
import { Tool } from './Tool';
import { ChunkType, TaskType, Chunk, Task } from '../../interfaces/AgentTypes';

// Re-export for backward compatibility
export { Tool, ChunkType, TaskType };


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
    public currentTask: Task | null = null;

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

    async generateStreamingResponse(prompt: string) {
        let response = '';
        if (this.streamingLLM && this.streamingLLM.generateStream) {
            for await (const element of this.streamingLLM.generateStream(prompt)) {
                if (element.token) {
                    response += element.token;
                    this.eventEmitter.emit('token', element.token);
                }
                if (element.finishReason) {
                    // done
                    break;
                }
            }
        } else if (this.streamingLLM && (this.streamingLLM as any).generate) {
            response = await (this.streamingLLM as any).generate(prompt);
        } else {
            throw new Error(`No generate method available; streamingLLM is: ${this.streamingLLM}`);
        }
        return response;
    }

    async run(task: Task): Promise<string | { content: string, annotation?: any, annotations?: Record<string, any> }> {
        this.currentTask = task;
        try {
            const prompt = this.buildPrompt(task);            
            let response = await this.generateStreamingResponse(prompt);
            return this.postProcessResponse(response);
        } catch (error) {
            this.eventEmitter.emit('error', error);
            throw error;
        }
    }

    protected getScratchpadContent(task: Task): string {
        return task.scratchpad
            .filter(c => c.type === ChunkType.Input || c.type === ChunkType.LlmOutput)
            .map(c => c.content)
            .join('\n');
    }

    protected getFilteredContents(task: Task, type: ChunkType): string {
        return task.scratchpad.filter(c => c.type === type).map(c => c.content).join('\n');
    }

    protected getInputText(task: Task): string {
        const inputs = task.scratchpad.filter(c => c.type === ChunkType.Input);
        if (inputs.length > 0) {
            // Use the content of the last input chunk
            return inputs[inputs.length - 1].content;
        } else {
            // Fallback to task.input.text if available
            const input = task.input;
            return (typeof input === 'object' && input !== null && 'text' in input) ? input.text : JSON.stringify(input);
        }
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

    protected postProcessResponse(response: string | { content: string, annotation?: any, annotations?: Record<string, any> }): string | { content: string, annotation?: any, annotations?: Record<string, any> } {
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

    /**
     * Writes data to the arena's session-global data chunks.
     * @param data The data to store.
     */
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

    /**
     * Retrieves data chunks from the task's scratchpad.
     * @param task The task from which to retrieve data chunks.
     * @returns Array of data objects stored by this agent in the task.
     */
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

    /**
     * Retrieves data chunks from the arena's session-global storage.
     * @returns Array of data objects stored by this agent in the session.
     */
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

    /**
     * Retrieves all data chunks from session-global and task-scoped storage.
     * @param task Optional task to include task-scoped data.
     * @returns Array of all data objects stored by this agent.
     */
    public getAllDataChunks(task?: Task): any[] {
        const sessionData = this.getSessionDataChunks();
        const taskData = task ? this.getTaskDataChunks(task) : [];
        return [...sessionData, ...taskData];
    }

    /**
     * Annotates a chunk with data under the specified FQDN.
     * @param chunk The chunk to annotate.
     * @param annotation The annotation data.
     * @param fqdn Optional FQDN to use instead of the agent's default.
     */
    public writeChunkAnnotation(chunk: Chunk, annotation: any, fqdn?: string): void {
        const effectiveFqdn = fqdn || this.fqdn;
        if (!effectiveFqdn) {
            throw new Error('Agent FQDN not set');
        }
        Logger.globalLog(`${AGENT_COLOR}${this.constructor.name}${RESET} annotating chunk: ${JSON.stringify(annotation)} with fqdn ${effectiveFqdn}`);
        if (!chunk.annotations) {
            chunk.annotations = {};
        }
        chunk.annotations[effectiveFqdn] = annotation;
    }

    /**
     * Retrieves annotations from a chunk.
     * @param chunk The chunk to retrieve annotations from.
     * @param fqdn Optional FQDN to filter by instead of the agent's default. If not provided, returns the full annotations map.
     * @returns The annotation value if fqdn is specified, or the full annotations map.
     */
    public getChunkAnnotation(chunk: Chunk, fqdn?: string): any | Record<string, any> {
        if (fqdn) {
            const effectiveFqdn = fqdn || this.fqdn;
            if (!effectiveFqdn) {
                throw new Error('Agent FQDN not set');
            }
            return chunk.annotations?.[effectiveFqdn];
        } else {
            return chunk.annotations || {};
        }
    }

    /**
     * Retrieves all annotations from a chunk.
     * @param chunk The chunk to retrieve annotations from.
     * @returns The full annotations map.
     */
    public getAllChunkAnnotations(chunk: Chunk): Record<string, any> {
        return chunk.annotations || {};
    }

    abstract buildPrompt(task: Task): string;
}