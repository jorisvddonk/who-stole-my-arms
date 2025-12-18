import { EventEmitter } from 'node:events';
import { StreamingLLMInvoke } from '../../interfaces/LLMInvoke';
import { Logger, AGENT_COLOR, TOOL_COLOR, RESET } from '../logging/debug-logger';
import { Tool } from './Tool';
import { Evaluator } from './Evaluator';
import { ChunkType, TaskType, Chunk, Task } from '../../interfaces/AgentTypes';

// Re-export for backward compatibility
export { Tool, ChunkType, TaskType };



/**
 * Abstract base class for LLM agents that can process tasks using language models.
 * Agents manage tools, handle streaming responses, and manage data chunks in tasks.
 */
export abstract class LLMAgent {
    eventEmitter: EventEmitter;
    public supportsContinuation: boolean = false;
    public tools: Record<string, Tool> = {};
    public registeredAgents: Record<string, LLMAgent> = {};
    public evaluators: (string | Evaluator)[] | null = null; // FQDNs or Evaluator instances; null means all available, empty array means none
    protected streamingLLM: StreamingLLMInvoke;
    public fqdn: string;
    public currentTask: Task | null = null;

    /**
     * Creates a new LLM agent instance.
     * @param streamingLLM The streaming LLM interface to use for generating responses.
     * @param arena The arena context for managing agent events and data.
     */
    constructor(streamingLLM: StreamingLLMInvoke, arena: any) {
        this.streamingLLM = streamingLLM;
        this.eventEmitter = new EventEmitter();
        this.fqdn = `agents.${this.constructor.name}`;
        if (arena) {
            arena.wireAgentEventEmitter(this);
        }
    }

    /**
     * Registers a tool with this agent for use during task execution.
     * @param tool The tool instance to register.
     */
    registerTool(tool: Tool) {
        this.tools[tool.name] = tool;
    }

    /**
     * Registers a sub-agent with this agent.
     * @param agent The agent instance to register.
     */
    registerAgent(agent: LLMAgent) {
        this.registeredAgents[agent.constructor.name] = agent;
    }

    /**
     * Sets the streaming LLM interface for this agent.
     * @param streamingLLM The streaming LLM interface to use.
     */
    setStreamingLLM(streamingLLM: StreamingLLMInvoke) {
        this.streamingLLM = streamingLLM;
    }

    /**
     * Generates a streaming response from the LLM using the provided prompt.
     * @param prompt The prompt to send to the LLM.
     * @returns The complete response string from the LLM.
     */
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

    /**
     * Executes the agent on the given task.
     * @param task The task to process.
     * @returns The agent's response, which may be a string or an object with content and annotations.
     */
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

    /**
     * Parses tool results from the scratchpad content.
     * @param scratchpad The scratchpad string containing tool results.
     * @returns Array of parsed tool result objects.
     */
    static parseToolResults(scratchpad: string): Array<any> {
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

    /**
     * Parses agent results from the scratchpad content.
     * @param scratchpad The scratchpad string containing agent results.
     * @returns Array of parsed agent result objects.
     */
    static parseAgentResults(scratchpad: string): Array<any> {
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

    /**
     * Gets the content from input and LLM output chunks in the task's scratchpad.
     * @param task The task to extract content from.
     * @returns The concatenated content from relevant chunks.
     */
    protected getScratchpadContent(task: Task): string {
        return task.scratchpad
            .filter(c => c.type === ChunkType.Input || c.type === ChunkType.LlmOutput)
            .map(c => c.content)
            .join('\n');
    }

    /**
     * Gets the content from chunks of a specific type in the task's scratchpad.
     * @param task The task to extract content from.
     * @param type The chunk type to filter by.
     * @returns The concatenated content from chunks of the specified type.
     */
    protected getFilteredContents(task: Task, type: ChunkType): string {
        return task.scratchpad.filter(c => c.type === type).map(c => c.content).join('\n');
    }

    /**
     * Extracts the input text from the task.
     * @param task The task to extract input from.
     * @returns The input text, either from the last input chunk or the task's input field.
     */
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

    /**
     * Extracts the last input text or tool output from the task.
     * @param task The task to extract input from.
     * @returns The input text or tool output, either from the last input/tooloutput chunk or the task's input field.
     */
    protected getInputTextOrToolOutput(task: Task): string {
        const inputs = task.scratchpad.filter(c => (c.type === ChunkType.Input || c.type === ChunkType.ToolOutput));
        if (inputs.length > 0) {
            // Use the content of the last chunk
            return inputs[inputs.length - 1].content;
        } else {
            // Fallback to task.input.text if available
            const input = task.input;
            return (typeof input === 'object' && input !== null && 'text' in input) ? input.text : JSON.stringify(input);
        }
    }

    /**
     * Safely parses agent results from content, optionally adding error chunks on failure.
     * @param task The task context.
     * @param contents The content to parse.
     * @param addErrorChunk Whether to add an error chunk to the task on parse failure.
     * @returns Array of parsed agent results, or empty array if parsing failed and addErrorChunk is true.
     */
    protected parseAgentResultsSafe(task: Task, contents: string, addErrorChunk: boolean = false): any[] {
        try {
            return LLMAgent.parseAgentResults(contents);
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

    /**
     * Safely parses tool results from content, optionally adding error chunks on failure.
     * @param task The task context.
     * @param contents The content to parse.
     * @param addErrorChunk Whether to add an error chunk to the task on parse failure.
     * @returns Array of parsed tool results, or empty array if parsing failed and addErrorChunk is true.
     */
    protected parseToolResultsSafe(task: Task, contents: string, addErrorChunk: boolean = false): any[] {
        try {
            return LLMAgent.parseToolResults(contents);
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

    /**
     * Adds a chunk to the task's scratchpad and emits relevant events.
     * @param task The task to add the chunk to.
     * @param chunk The chunk to add.
     */
    public addChunk(task: Task, chunk: Chunk): void {
        if (chunk.type === ChunkType.LlmOutput && !chunk.messageId) {
            // Find the last input chunk with messageId in scratchpad
            for (let i = task.scratchpad.length - 1; i >= 0; i--) {
                const c = task.scratchpad[i];
                if (c.type === ChunkType.Input && c.messageId) {
                    chunk.messageId = c.messageId;
                    break;
                }
            }
            // If no input in scratchpad, use task.input.messageId
            if (!chunk.messageId && task.input && task.input.messageId) {
                chunk.messageId = task.input.messageId;
            }
        }
        task.scratchpad.push(chunk);
        this.eventEmitter.emit('chunk', chunk);
        this.eventEmitter.emit(`chunk:${chunk.type}`, chunk);
    }

    /**
     * Post-processes the response from the LLM before returning it.
     * @param response The raw response from the LLM.
     * @returns The processed response.
     */
    protected postProcessResponse(response: string | { content: string, annotation?: any, annotations?: Record<string, any> }): string | { content: string, annotation?: any, annotations?: Record<string, any> } {
        return response;
    }

    /**
     * Writes data to the task's scratchpad as a data chunk.
     * @param task The task to which the data chunk will be added.
     * @param data The data to store.
     */
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

    /**
     * Builds the prompt to send to the LLM for the given task.
     * @param task The task to build a prompt for.
     * @returns The constructed prompt string.
     */
    abstract buildPrompt(task: Task): string;
}