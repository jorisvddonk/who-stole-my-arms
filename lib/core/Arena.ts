import { EventEmitter } from 'node:events';
import { LLMAgent, Tool } from './LLMAgent';
import { ChunkType, Chunk, Task, TaskType } from '../../interfaces/AgentTypes';
import { AgentManager } from '../agents/AgentManager';
import { EvaluatorManager } from '../evaluators/EvaluatorManager';
import { Evaluator } from './Evaluator';
import { AgentEvaluator } from '../evaluators/AgentEvaluator';
import { ErrorAgent } from '../agents/ErrorAgent';
import { Logger, DEBUG_COLOR, GLOBAL_COLOR, AGENT_COLOR, TOOL_COLOR, YELLOW, BRIGHT_YELLOW, RESET } from '../logging/debug-logger';
import { generateId } from '../util/id';

/**
 * Central orchestration class that manages agents, tasks, and evaluators.
 * Handles task execution, agent coordination, and automatic chunk evaluation.
 */
export class Arena {
    eventEmitter: EventEmitter;

    streamingLLM: any;

    sessionId?: string;

    // Agents that are always allowed to be called, even if the calling agent has registered agents
    alwaysAllowedAgents: string[] = ['ErrorAgent'];

    // Registry of available agents that can be called. These are only available for agents that don't have registered agents themselves.
    agents: Record<string, LLMAgent>;

    // Registry of evaluators for annotating chunks (can include sequential groups)
    evaluators: (Evaluator | Evaluator[])[];

    taskQueue: Task[] = [];

    taskStore: Record<string, Task> = {};

    activeTasks: Record<string, Promise<void>> = {};

    invocationLog: Array<{id: string, type: 'agent' | 'tool', name: string, parent_id: string | null, params?: any, result?: any}> = [];

    currentContinuationTask: Task | null = null;

    errorCount: number = 0;

    dataChunks: Chunk[] = [];

    // Set of chunk IDs currently awaiting evaluator processing
    awaitingEvaluatorChunks: Set<string> = new Set();

    // Flag to prevent multiple concurrent event loops
    private eventLoopRunning = false;

    /**
     * Creates a new Arena instance.
     * @param streamingLLM The streaming LLM interface for agent communication.
     * @param agentManager Manager containing registered agents.
     * @param evaluatorManager Manager containing registered evaluators.
     * @param sessionId Optional session identifier for session-specific context.
     */
    constructor(streamingLLM: any, agentManager: AgentManager, evaluatorManager: EvaluatorManager, sessionId: string) {
        this.streamingLLM = streamingLLM;
        this.eventEmitter = new EventEmitter();
        this.agents = agentManager.getAgents();
        evaluatorManager.init(streamingLLM);
        this.sessionId = sessionId;
        this.evaluators = evaluatorManager.getEvaluators();
        const allFqdns = this.evaluators.flat().map(e => e.fqdn);
        Logger.globalLog(`Arena created with evaluators: ${allFqdns.join(', ')}`);
        // Set arena on agents and wire events
        for (const agent of Object.values(this.agents)) {
            (agent as any).arena = this;
            this.wireAgentEventEmitter(agent);
        }
        // Wire evaluators to chunk events
        this.wireEvaluators();

        // Set up reactive task processing - start event loop when tasks are queued
        this.eventEmitter.on('taskQueued', () => {
            this.startEventLoopIfNeeded();
        });
        // Wire evaluator events
        for (const evaluator of Object.values(this.evaluators)) {
            if ((evaluator as any).eventEmitter) {
                this.wireEvaluatorEventEmitter(evaluator as any);
            }
        }
    }

    public destroy() {
        this.eventEmitter.removeAllListeners();
    }

    /**
     * Updates the streaming LLM interface for all agents.
     * @param newStreamingLLM The new streaming LLM interface to use.
     */
    updateStreamingLLM(newStreamingLLM: any) {
        this.streamingLLM = newStreamingLLM;
        for (const agent of Object.values(this.agents)) {
            agent.setStreamingLLM(newStreamingLLM);
        }
    }

    /**
     * Wires up event listeners for an agent's event emitter to forward events to the arena.
     * @param agent The agent whose events to wire up.
     */
     public wireAgentEventEmitter(agent: LLMAgent) {
         // wire up logging
         agent.eventEmitter.on('chunk', (data: any) => {
             let chunk: Chunk;
             let agentName: string;
             if (data.type && data.content !== undefined) { // it's a chunk
                 chunk = data;
                 agentName = agent.constructor.name;
             } else {
                 ({ agentName, chunk } = data);
             }

              Logger.globalLog(`Chunk from ${AGENT_COLOR}${agentName}${RESET}: ${chunk.type} - ${chunk.content}`);
              // Add metadata to indicate if chunk is from evaluator task
              (chunk as any).fromEvaluatorTask = agent.currentTask?.taskType === TaskType.Evaluator;
              this.eventEmitter.emit('chunk', {agentName, chunk, agent});
         });
        agent.eventEmitter.on('token', (token: string) => {
            //Logger.globalLog(`Token from ${AGENT_COLOR}${agent.constructor.name}${RESET}: ${token}`);
            this.eventEmitter.emit('token', {agentName: agent.constructor.name, token});
        });
        // wire up event forwarders
        agent.eventEmitter.on('toolCall', (call: any) => {
            this.eventEmitter.emit('toolCall', {agentName: agent.constructor.name, call});
        });
        agent.eventEmitter.on('agentCall', (call: any) => {
            this.eventEmitter.emit('agentCall', {agentName: agent.constructor.name, call});
        });
        agent.eventEmitter.on('parseError', (details: any) => {
            this.eventEmitter.emit('parseError', {agentName: agent.constructor.name, error: details.error, type: details.type});
        });
        // wire up error, which forwards and keeps track of the error count
        agent.eventEmitter.on('error', (error: any) => {
            this.errorCount++;
            this.eventEmitter.emit('error', {agentName: agent.constructor.name, error});
        });
    }

    /**
     * Wires up event listeners for an evaluator's event emitter to forward events to the arena.
     * @param evaluator The evaluator whose events to wire up.
     */
    public wireEvaluatorEventEmitter(evaluator: any) {
        // wire up logging
        evaluator.eventEmitter.on('chunk', (chunk: Chunk) => {
            Logger.globalLog(`Evaluator Chunk from ${AGENT_COLOR}${evaluator.constructor.name}${RESET}: ${chunk.type} - ${chunk.content}`);
            this.eventEmitter.emit('evaluatorChunk', {evaluatorName: evaluator.constructor.name, chunk});
        });
        evaluator.eventEmitter.on('token', (token: string) => {
            Logger.globalLog(`Evaluator Token from ${AGENT_COLOR}${evaluator.constructor.name}${RESET}: ${token}`);
            this.eventEmitter.emit('evaluatorToken', {evaluatorName: evaluator.constructor.name, token});
        });
        // wire up event forwarders
        evaluator.eventEmitter.on('toolCall', (call: any) => {
            this.eventEmitter.emit('evaluatorToolCall', {evaluatorName: evaluator.constructor.name, call});
        });
        evaluator.eventEmitter.on('agentCall', (call: any) => {
            this.eventEmitter.emit('evaluatorAgentCall', {evaluatorName: evaluator.constructor.name, call});
        });
        evaluator.eventEmitter.on('parseError', (details: any) => {
            this.eventEmitter.emit('evaluatorParseError', {evaluatorName: evaluator.constructor.name, error: details.error, type: details.type});
        });
        // wire up error, which forwards and keeps track of the error count
        evaluator.eventEmitter.on('error', (error: any) => {
            this.errorCount++;
            this.eventEmitter.emit('evaluatorError', {evaluatorName: evaluator.constructor.name, error});
        });
    }

    /**
     * Sets up event listeners to trigger evaluator execution when chunks are emitted.
     */
    private wireEvaluators(): void {
        this.eventEmitter.on('chunk', ({ chunk, agentName, agent }: { agentName: string, chunk: Chunk, agent?: any }) => {
            this.awaitingEvaluatorChunks.add(chunk.id);
            (async () => {
                Logger.globalLog(`Event listener called for chunk type ${chunk.type}, agentName: ${agentName}\n`);
                await this.runEvaluators(chunk, agent);
                this.awaitingEvaluatorChunks.delete(chunk.id);
                this.eventEmitter.emit('evaluatorsFinished', { chunk, agentName, agent });
            })();
        });
    }

    /**
     * Waits for evaluators to finish processing a specific chunk.
     * @param chunk The chunk to wait for evaluators to finish.
     * @returns A promise that resolves when evaluators have finished for this chunk.
     */
    public waitForEvaluators(chunk: Chunk): Promise<void> {
        if (!this.awaitingEvaluatorChunks.has(chunk.id)) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            const listener = (details: { chunk: Chunk, agentName: string, agent?: any }) => {
                if (details.chunk.id === chunk.id) {
                    this.eventEmitter.off('evaluatorsFinished', listener);
                    resolve();
                }
            };
            this.eventEmitter.on('evaluatorsFinished', listener);
        });
    }

    /**
     * Adds an input chunk to a task's scratchpad and emits it for evaluation.
     * @param task The task to add the chunk to.
     * @param chunk The input chunk to add.
     */
    public addInputChunk(task: Task, chunk: Chunk): void {
        Logger.globalLog(`addInputChunk called for task ${task.id}, chunk type ${chunk.type}\n`);
        task.scratchpad.push(chunk);
        this.eventEmitter.emit('chunk', { agentName: null, chunk });
    }

    /**
     * Runs evaluators that support the given chunk type and are selected by the agent.
     * Evaluators can be run in parallel or sequential groups.
     * @param chunk The chunk to evaluate.
     * @param agent The agent that emitted the chunk.
     */
    private async runEvaluators(chunk: Chunk, agent?: LLMAgent): Promise<void> {
        Logger.globalLog(`runEvaluators called for chunk type ${chunk.type}, content: ${chunk.content ? chunk.content.substring(0, 20) : 'undefined'}`);
        let evaluatorConfig: (Evaluator | Evaluator[])[] = [];
        let agentEvaluatorFqdns: string[] = [];
        if (agent && agent.evaluators && agent.evaluators.length > 0) {
            // Agent specifies evaluators: only run those
            const agentInstances: (Evaluator | Evaluator[])[] = [];
            const agentEvalFqdns = new Set<string>();
            for (const e of agent.evaluators) {
                if (typeof e === 'string') {
                    agentEvalFqdns.add(e);
                } else if (Array.isArray(e)) {
                    agentInstances.push(e);
                    for (const sub of e) {
                        agentEvalFqdns.add(sub.fqdn);
                    }
                } else {
                    agentInstances.push(e);
                    agentEvalFqdns.add(e.fqdn);
                }
            }
            evaluatorConfig = agentInstances;
            agentEvaluatorFqdns = Array.from(agentEvalFqdns);
        } else {
            // No agent-specific evaluators: run all global ones
            evaluatorConfig = [...this.evaluators];
            agentEvaluatorFqdns = evaluatorConfig.flat().map(e => e.fqdn);
        }
        const allFqdns = evaluatorConfig.flat().map(e => e.fqdn);
        Logger.debugLog(`All available evaluator FQDNs: ${allFqdns.join(', ')}`);
        Logger.debugLog(`Agent evaluator FQDNs (filtered): ${agentEvaluatorFqdns.join(', ')}`);
        Logger.debugLog(`Evaluator config structure: ${evaluatorConfig.map(item => Array.isArray(item) ? `[${item.map(e => e.fqdn).join(', ')}]` : item.fqdn).join(', ')}`);

        let checkEvaluatorSupported = (evaluator: Evaluator) => {
            const supportsType = evaluator.supportedChunkTypes.includes(chunk.type);
            const inAgentList = agentEvaluatorFqdns.includes(evaluator.fqdn);
            Logger.debugLog(`  Evaluator ${evaluator.fqdn}: supportsType=${supportsType}, inAgentList=${inAgentList}`);
            return supportsType && inAgentList;
        }

        // filter out all unsupported evaluators and map single evaluators into array of evaluators so we can simplify our code further down
        evaluatorConfig = evaluatorConfig.map(ev => {
            let evaluators;
            if (Array.isArray(ev)) {
                evaluators = ev;
            } else {
                evaluators = [ev];
            }
            return evaluators.filter(e => {
                 const supported = checkEvaluatorSupported(e);
                 const isAgentEvaluatorFromEvaluatorTask = (chunk as any).fromEvaluatorTask && e instanceof AgentEvaluator;
                 if (isAgentEvaluatorFromEvaluatorTask) {
                     Logger.debugLog(`Skipping AgentEvaluator ${e.fqdn} for chunk from evaluator task to prevent infinite loops`);
                 }
                 return supported && !isAgentEvaluatorFromEvaluatorTask;
             });
        });

        const promises = [];

        for (const item of evaluatorConfig) {
            if (Array.isArray(item)) {
                // Sequential group
                Logger.globalLog(`Running sequential group with ${item.length} evaluators for chunk type ${chunk.type}: ${item.map(e => e.fqdn).join(', ')}`);
                const promise = (async () => {
                    for (const evaluator of item) {
                        try {
                            Logger.globalLog(`  Running evaluator ${evaluator.fqdn} for chunk type ${chunk.type}..`);
                            const result = await evaluator.evaluate(chunk, this, agent);
                            if (result.annotation !== undefined || result.annotations !== undefined) {
                                Logger.globalLog(`  Evaluator ${evaluator.fqdn} succeeded with result: ${JSON.stringify(result)}`);
                                if (!chunk.annotations) {
                                    chunk.annotations = {};
                                }
                                if (result.annotation !== undefined) {
                                    chunk.annotations[evaluator.fqdn] = result.annotation;
                                }
                                if (result.annotations !== undefined) {
                                    Object.assign(chunk.annotations, result.annotations);
                                }
                            } else {
                                Logger.debugLog(`  Evaluator ${evaluator.fqdn} returned no annotations`);
                            }
                        } catch (error) {
                            Logger.debugLog(`  Evaluator ${evaluator.fqdn} failed: ${error}`);
                        }
                    }
                })();
                promises.push(promise);
            } else {
                // Single evaluator
                throw new Error("??? single evaluator found. should not happen!");
            }
        }

        await Promise.all(promises);
    }

    /**
     * Removes a task and all its child tasks from the arena.
     * @param taskId The ID of the task to remove.
     */
    removeTask(taskId: string) {
        const task = this.taskStore[taskId];
        if (!task) return;

        // Remove from taskStore
        delete this.taskStore[taskId];

        // Remove from taskQueue
        const queueIndex = this.taskQueue.findIndex(t => t.id === taskId);
        if (queueIndex !== -1) {
            this.taskQueue.splice(queueIndex, 1);
        }

        // Remove from invocationLog
        this.invocationLog = this.invocationLog.filter(inv => inv.id !== taskId);

        // Recursively remove children
        const children = this.invocationLog.filter(inv => inv.parent_id === taskId);
        for (const child of children) {
            this.removeTask(child.id);
        }

        // If it was currentContinuationTask, set to null
        if (this.currentContinuationTask?.id === taskId) {
            this.currentContinuationTask = null;
        }
    }

    /**
     * Find all chunks with a specific ID from all tasks.
     * @param id The chunk ID to filter by.
     */
    findChunksById(id: string) {
        let foundChunks: Chunk[] = [];
        for (const taskId in this.taskStore) {
            const task = this.taskStore[taskId];
            foundChunks = foundChunks.concat(task.scratchpad.filter(chunk => chunk.id === id));
        }
        return foundChunks;
    }

    /**
     * Check whether the supplied chunkId is the first input chunk of its task
     * @param id The chunk ID to filter by.
     */
    isChunkFirstInputChunk(id: string) {
        let foundChunks: Chunk[] = [];
        for (const taskId in this.taskStore) {
            const task = this.taskStore[taskId];
            const inputChunks = task.scratchpad.filter(chunk => chunk.type === ChunkType.Input);
            const firstChunk = inputChunks.shift();
            if (firstChunk) {
                if (firstChunk.id === id) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Removes all chunks with a specific ID from all tasks.
     * @param id The chunk ID to filter by.
     */
    removeChunksById(id: string) {
        for (const taskId in this.taskStore) {
            const task = this.taskStore[taskId];
            task.scratchpad = task.scratchpad.filter(chunk => chunk.id !== id);
        }
    }

    /**
     * Get the taskid for a chunk id
     * @param id The chunk ID to filter by.
     */
    getTaskIDForChunk(id: string) {
        let foundChunks: Chunk[] = [];
        for (const taskId in this.taskStore) {
            const task = this.taskStore[taskId];
            const found = task.scratchpad.filter(chunk => chunk.id === id);
            if (found.length > 0) {
                return taskId;
            }
        }
        return undefined;
    }

    /**
     * Generates a unique ID for tasks.
      * @returns A random string ID.
      */
     static generateId(): string {
         return generateId();
     }

    /**
     * Parses tool calls from a response string.
     * @param response The response string containing tool calls.
     * @returns Array of parsed tool call objects.
     */
    static parseToolCalls(response: string): Array<{ name: string; parameters: any }> {
        const startCount = (response.match(/<\|tool_call\|>/g) || []).length;
        const endCount = (response.match(/<\|tool_call_end\|>/g) || []).length;
        if (startCount !== endCount) {
            throw new Error("tool call incomplete");
        }
        const toolCallRegex = /<\|tool_call\|>(.*?)<\|tool_call_end\|>/gs;
        const calls = [];
        let match;
        while ((match = toolCallRegex.exec(response)) !== null) {
            const callData = JSON.parse(match[1]);
            calls.push(callData);
        }
        return calls;
    }

    /**
     * Parses agent calls from a response string.
     * @param response The response string containing agent calls.
     * @returns Array of parsed agent call objects.
     */
    static parseAgentCalls(response: string): Array<{ name: string; input: any }> {
        const startCount = (response.match(/<\|agent_call\|>/g) || []).length;
        const endCount = (response.match(/<\|agent_call_end\|>/g) || []).length;
        if (startCount !== endCount) {
            throw new Error("agent call incomplete");
        }
        const agentCallRegex = /<\|agent_call\|>(.*?)<\|agent_call_end\|>/gs;
        const calls = [];
        let match;
        while ((match = agentCallRegex.exec(response)) !== null) {
            const content = match[1].trim();
            let callData: { name: string; input: any };

            try {
                // Try parsing as JSON object with "name" and "input"
                const parsed = JSON.parse(content);
                if (typeof parsed === 'object' && parsed !== null && 'name' in parsed && 'input' in parsed) {
                    callData = parsed;
                } else {
                    throw new Error("Invalid agent call format");
                }
            } catch (e) {
                // Try parsing as JSON object without outer braces
                try {
                    const wrapped = `{${content}}`;
                    const parsed = JSON.parse(wrapped);
                    if (typeof parsed === 'object' && parsed !== null && 'name' in parsed && 'input' in parsed) {
                        callData = parsed;
                    } else {
                        throw new Error("Invalid agent call format");
                    }
                } catch (wrapError) {
                    // Try parsing as tuple format: "Name", {input}
                    const commaIndex = content.indexOf(',');
                    if (commaIndex === -1) {
                        throw new Error("Invalid agent call format: missing input");
                    }
                    const namePart = content.substring(0, commaIndex).trim();
                    const inputPart = content.substring(commaIndex + 1).trim();

                    // Name should be a quoted string
                    if (!namePart.startsWith('"') || !namePart.endsWith('"')) {
                        throw new Error("Invalid agent call format: name must be quoted");
                    }
                    const name = namePart.slice(1, -1); // Remove quotes

                    try {
                        const input = JSON.parse(inputPart);
                        callData = { name, input };
                    } catch (parseError) {
                        throw new Error("Invalid agent call format: input must be valid JSON");
                    }
                }
            }

            calls.push(callData);
        }
        return calls;
    }

    /**
     * Executes an agent for the given task.
     * @param task The task to execute.
     * @returns The agent's response.
     */
    async run_agent(task: Task): Promise<string | {content: string, annotation?: any, annotations?: Record<string, any>}> {
        if (!this.invocationLog.some(inv => inv.id === task.id)) {
            this.invocationLog.push({id: task.id, type: 'agent', name: task.agent_name, parent_id: task.parent_task_id, params: task.input});
        }

        const agent = this.agents[task.agent_name] || (task.agent_name === 'ErrorAgent' ? new ErrorAgent(this.streamingLLM, this) : null);
        if (!agent) {
            Logger.debugLog(`Unknown agent: ${AGENT_COLOR}${task.agent_name}${RESET}`);
            throw new Error("Unknown agent");
        }

        try {
            const result = await agent.run(task);
            return result;
        } catch (e) {
            if (task.agent_name === 'ErrorAgent') {
                Logger.debugLog(`ErrorAgent failed, using fallback`);
                const fallback = { content: "<|error|>An unexpected error occurred during processing.<|error_end|>" };
                return fallback;
            }
            throw e;
        }
    }

    /**
     * Checks if a task has received results from all its child tasks.
     * @param task The task to check.
     * @returns True if all child results have been received.
     */
    private hasAllChildResults(task: Task): boolean {
        const childCount = this.invocationLog.filter(inv => inv.parent_id === task.id && inv.type === 'agent').length;
        const resultCount = task.scratchpad.filter(chunk => chunk.type === ChunkType.AgentOutput).length;
        return resultCount >= childCount;
    }

    /**
     * Returns the result of a completed task to its parent task or as final output.
     * @param task The completed task.
     * @param result The result from the task execution.
     */
    return_result_to_parent(task: Task, result: string | {content: string, annotation?: any, annotations?: Record<string, any>}) {
        const output = typeof result === 'string' ? result : result.content;
        Logger.debugLog(`Returning result from task ${task.id} (${AGENT_COLOR}${task.agent_name}${RESET}): ${output}`);
        if (task.parent_task_id === null || task.taskType === TaskType.Evaluator) {
            Logger.globalLog(`${YELLOW}FINAL OUTPUT:${RESET} ${BRIGHT_YELLOW}${output}${RESET}`);
            if (process.argv.includes('--debug')) {
                this.printInvocationTree();
            }
            // Call completion callback if present
            if (task.onComplete) {
                task.onComplete(result);
            }
            return;
        }
        const parent = this.taskStore[task.parent_task_id];
        Logger.debugLog(`Adding result to parent task ${parent.id} (${AGENT_COLOR}${parent.agent_name}${RESET}) scratchpad`);
        const agentResult = `<|agent_result|>${JSON.stringify(output)}<|agent_result_end|>`;
        const agentChunk = { id: Arena.generateId(), type: ChunkType.AgentOutput, content: agentResult, processed: true };
        const parentAgent = this.agents[parent.agent_name];
        parentAgent.addChunk(parent, agentChunk);
        if (this.hasAllChildResults(parent)) {
            if (parent.taskType !== TaskType.Evaluator) {
                this.queueTask(parent, 'parent_completion');
                Logger.debugLog(`Re-queued parent task ${parent.id} with agent result chunk: ${agentResult}`);
            } else {
                Logger.debugLog(`Parent evaluator task ${parent.id} completed with agent result chunk: ${agentResult}`);
            }
        } else {
            Logger.debugLog(`Parent task ${parent.id} waiting for more child results (${this.invocationLog.filter(inv => inv.parent_id === parent.id && inv.type === 'agent').length} children, ${parent.scratchpad.filter(chunk => chunk.type === ChunkType.AgentOutput).length} results received)`);
        }
    }

    /**
     * Prints a formatted tree view of all task invocations and their relationships.
     */
    printInvocationTree() {
        console.log('\n');
        Logger.globalLog("\x1b[1;36m======================================== INVOCATION TREE SUMMARY ========================================\x1b[0m");

        const buildTree = (parentId: string | null, depth: number = 0): void => {
            const children = this.invocationLog.filter((inv: any) => inv.parent_id === parentId);
            for (const child of children) {
                const indent = "  ".repeat(depth);
                const typeLabel = child.type === 'agent' ? '\x1b[1;34mAgent\x1b[0m' : '\x1b[1;33mTool \x1b[0m';
                const nameColor = child.type === 'agent' ? '\x1b[1;32m' : '\x1b[1;35m';
                const paramsColor = child.type === 'agent' ? '\x1b[32m' : '\x1b[35m';
                const retryInfo = child.type === 'agent' ? ` (retries: ${this.taskStore[child.id]?.retryCount || 0})` : '';
                const taskTypeInfo = this.taskStore[child.id]?.taskType ? ` [${this.taskStore[child.id].taskType}]` : '';
                const namePart = `${indent}${typeLabel}: ${nameColor}${child.name}\x1b[0m${retryInfo}${taskTypeInfo}`;
                let paramsText = child.params ? JSON.stringify(child.params) : '';
                if (paramsText.length > 50) {
                    paramsText = paramsText.substring(0, 47) + '...';
                }
                const paramsStr = child.params ? `${paramsColor}${paramsText}\x1b[0m` : '';
                const namePadding = ' '.repeat(Math.max(0, 35 - namePart.replace(/\x1b\[[0-9;]*m/g, '').length));  // Adjusted for retry info
                const paramsPadding = ' '.repeat(Math.max(0, 45 - paramsStr.replace(/\x1b\[[0-9;]*m/g, '').length));
                Logger.globalLog(`${namePart}${namePadding}${paramsStr}${paramsPadding}(\x1b[90m${child.id}\x1b[0m)`);
                buildTree(child.id, depth + 1);
            }
        };

        buildTree(null, 0);
        const errorStyle = this.errorCount > 0 ? '\x1b[1;31m' : '\x1b[31m';
        Logger.globalLog(`${errorStyle}Errors: ${this.errorCount}\x1b[0m`);
        Logger.globalLog("\x1b[1;36m========================================================================================================\x1b[0m\n");
    }

    /**
     * Processes a single task.
     * @param task The task to process.
     * @param isInteractive Whether the loop is running in interactive mode.
     */
    private async processTask(task: Task, isInteractive: boolean): Promise<void> {
        task.executionCount = (task.executionCount || 0) + 1;
        Logger.debugLog(`Processing task ${task.id} (${AGENT_COLOR}${task.agent_name}${RESET}) - execution ${task.executionCount}`);
        let hasNewErrors = false;
        let result;
        try {
            result = await this.run_agent(task);
        } catch (e: any) {
            Logger.debugLog(`Task ${task.id} (${AGENT_COLOR}${task.agent_name}${RESET}) failed: ${e}`);
            if (task.onComplete) {
                // For evaluator tasks, resolve with error
                task.onComplete({ content: `<|error|>Agent ${task.agent_name} failed: ${e.message}<|error_end|>` });
                return;
            } else {
                throw e;
            }
        }
        let response: string;
        let annotations: Record<string, any> = {};
        const agent = this.agents[task.agent_name];
        if (typeof result === 'string') {
            response = result;
        } else {
            response = result.content;
            if (result.annotation) {
                annotations = { [agent.fqdn]: result.annotation };
            }
            if (result.annotations) {
                annotations = { ...annotations, ...result.annotations };
            }
        }
        Logger.debugLog(`Agent response: ${response}`);

        // Add the response as a new chunk
        const newChunk: Chunk = { id: Arena.generateId(), type: ChunkType.LlmOutput, content: response, processed: false };
        if (annotations) {
            newChunk.annotations = annotations;
        }
        Logger.debugLog(`- adding chunk`);
        agent.addChunk(task, newChunk);
        Logger.debugLog(`- waiting for evaluators`);
        await this.waitForEvaluators(newChunk);
        Logger.debugLog(`- done waiting`);

        const TOOL_INVOCATION_EVALUATOR_FQDN = 'evaluators.ToolInvocationEvaluator';

        const lastChunk = task.scratchpad[task.scratchpad.length - 1];
        if (lastChunk.type === ChunkType.LlmOutput && !lastChunk.processed) {
            let agentCalls: Array<{ name: string; input: any }> = [];
            try {
                agentCalls = Arena.parseAgentCalls(lastChunk.content);
            } catch (e) {
                const errorChunk = { id: Arena.generateId(), type: ChunkType.Error, content: `Parse error in agentCalls: ${e}`, processed: true };
                agent.addChunk(task, errorChunk);
                this.eventEmitter.emit('parseError', { type: 'agentCalls', error: e, content: lastChunk.content });
                hasNewErrors = true;
            }

            const toolInvocationAnnotation = lastChunk.annotations?.[TOOL_INVOCATION_EVALUATOR_FQDN];
            let hasToolInvocations = false;

            if (toolInvocationAnnotation && toolInvocationAnnotation.toolInvocations) {
                for (const invocation of toolInvocationAnnotation.toolInvocations) {
                    agent.eventEmitter.emit('toolCall', { name: invocation.name, parameters: invocation.parameters });
                    const toolId = `tool_${task.id}_${invocation.name}`;
                    if (!this.invocationLog.some(inv => inv.id === toolId)) {
                        this.invocationLog.push({id: toolId, type: 'tool', name: invocation.name, parent_id: task.id, params: invocation.parameters});
                    }

                    if (invocation.success) {
                        const toolResultStr = `<|tool_result|>${JSON.stringify(invocation.result)}<|tool_result_end|>`;
                        const toolChunk: Chunk = { id: Arena.generateId(), type: ChunkType.ToolOutput, content: toolResultStr, processed: true };
                        agent.addChunk(task, toolChunk);
                        Logger.debugLog(`Tool result: ${toolResultStr}`);
                    } else {
                        const errorContent = `<|error|>Tool ${invocation.name} failed: ${invocation.error}<|error_end|>`;
                        const errorChunk = { id: Arena.generateId(), type: ChunkType.Error, content: errorContent, processed: true };
                        agent.addChunk(task, errorChunk);
                        this.eventEmitter.emit('parseError', { type: 'toolExecution', error: invocation.error, content: invocation.name });
                        Logger.debugLog(`Tool ${TOOL_COLOR}${invocation.name}${RESET} failed: ${invocation.error}`);
                        hasNewErrors = true;
                    }
                    hasToolInvocations = true;
                }
            }

            for (const call of agentCalls) {
                if (agent.registeredAgents[call.name] || this.alwaysAllowedAgents.includes(call.name) && this.agents[call.name] || (Object.keys(agent.registeredAgents).length === 0 && this.agents[call.name])) {
                    agent.eventEmitter.emit('agentCall', call);
                    Logger.debugLog(`Creating agent call: ${AGENT_COLOR}${call.name}${RESET} with input: ${JSON.stringify(call.input)}`);
                    const childTask: Task = {
                        id: Arena.generateId(),
                        agent_name: call.name,
                        input: call.input,
                        parent_task_id: task.id,
                        scratchpad: [{ id: Arena.generateId(), type: ChunkType.Input, content: JSON.stringify(call.input), processed: true }],
                        retryCount: 0,
                        executionCount: 0,
                        sessionId: this.sessionId
                    };
                    this.taskStore[childTask.id] = childTask;
                    this.queueTask(childTask, 'agent_call');
                    Logger.debugLog(`Created child task ${childTask.id} (${AGENT_COLOR}${childTask.agent_name}${RESET})`);
                } else {
                    const errorContent = `<|error|>Unknown agent: ${call.name}<|error_end|>`;
                    const errorChunk = { id: Arena.generateId(), type: ChunkType.Error, content: errorContent, processed: true };
                    agent.addChunk(task, errorChunk);
                    this.eventEmitter.emit('parseError', { type: 'agentExecution', error: errorContent, content: call.name });
                    hasNewErrors = true;
                    Logger.debugLog(`Agent ${AGENT_COLOR}${call.name}${RESET} not found`);
                }
            }

            lastChunk.processed = true;

            if (hasNewErrors) {
                const maxRetries = task.taskType === TaskType.Evaluator ? 1 : 3;
                const maxExecutions = task.taskType === TaskType.Evaluator ? 2 : 10;
                if (task.retryCount < maxRetries && task.executionCount < maxExecutions) {
                    task.retryCount++;
                    this.queueTask(task, 'retry');
                    Logger.debugLog(`Re-queued task ${task.id} for retry (${task.retryCount}/${maxRetries}, executions: ${task.executionCount})`);
                } else {
                    const reason = task.executionCount >= 10 ? 'max executions reached' : 'max retries reached';
                    const errorDetails = `${reason}\n${task.scratchpad.filter(c => c.type === ChunkType.Error).map(c => c.content).join('\n')}`;
                    const errorTask: Task = {
                        id: Arena.generateId(),
                        agent_name: 'ErrorAgent',
                        input: errorDetails,
                        parent_task_id: task.id,
                        scratchpad: [{ id: Arena.generateId(), type: ChunkType.Input, content: errorDetails, processed: true }],
                        retryCount: 0,
                        executionCount: 0,
                        sessionId: this.sessionId
                    };
                    this.taskStore[errorTask.id] = errorTask;
                    this.queueTask(errorTask, 'error_handler');
                    if (this.currentContinuationTask?.id === task.id) {
                        this.currentContinuationTask = null;
                    }
                    Logger.debugLog(`Created ErrorAgent task ${errorTask.id} for exhausted task ${task.id} (${reason})`);
                    Logger.globalLog(`\x1b[31mERROR: Task ${task.id} failed - ${reason}\x1b[0m`);
                }
            } else if (hasToolInvocations) {
                // Re-queue task
                this.queueTask(task, 'tool_calls');
                Logger.debugLog(`Re-queued task ${task.id} after tool calls`);
            } else if (!hasToolInvocations && agentCalls.length === 0) {
                const agent = this.agents[task.agent_name];
                if (agent && agent.supportsContinuation && isInteractive) {
                    Logger.debugLog(`Continuation agent task ${task.id} provided response, waiting for more input`);
                    // Do not complete or return result; leave the task for continuation
                } else {
                    // No calls, final result
                    Logger.debugLog(`Task ${task.id} completed with final result: ${response}`);
                    this.return_result_to_parent(task, typeof result === 'string' ? result : result);
                }
            } else {
                // Has agent calls, parent waits for child
                Logger.debugLog(`Task ${task.id} waiting for child agents`);
            }
        } else {
            Logger.debugLog(`Last chunk already processed or not llmOutput`);
        }

        Logger.debugLog(`Task ${task.id} processing completed`);
    }

    /**
     * Queues a task and emits an event to trigger reactive processing.
     * @param task The task to queue
     * @param source Optional source identifier for debugging
     */
    queueTask(task: Task, source: string = 'unknown') {
        this.taskQueue.push(task);
        this.eventEmitter.emit('taskQueued', { task, source });
        Logger.debugLog(`Task ${task.id} (${task.agent_name}) queued from ${source}, total queue: ${this.taskQueue.length}`);
    }

    /**
     * Starts the event loop if there are pending tasks and no loop is currently running.
     * This provides reactive task processing - tasks are processed immediately when queued.
     */
    private async startEventLoopIfNeeded() {
        if (this.eventLoopRunning || this.taskQueue.length === 0) return;

        this.eventLoopRunning = true;
        try {
            await this.run_event_loop(false);
        } finally {
            this.eventLoopRunning = false;
        }
    }

    /**
     * Runs the main event loop that processes tasks from the queue in parallel, with one active execution per task ID.
     * @param isInteractive Whether the loop is running in interactive mode.
     */
    async run_event_loop(isInteractive: boolean = false) {
        Logger.debugLog(`Starting event loop with ${this.taskQueue.length} tasks in queue`);
        while (true) {
            // Collect and start any new tasks that can be started
            const tasksToStart: Task[] = [];
            for (const task of this.taskQueue) {
                if (!(task.id in this.activeTasks)) {
                    tasksToStart.push(task);
                    this.activeTasks[task.id] = this.processTask(task, isInteractive).finally(() => {
                        delete this.activeTasks[task.id];
                    });
                }
            }
            // Clear the queue since all tasks are either started or already active
            this.taskQueue.length = 0;

            if (tasksToStart.length > 0) {
                // Tasks were started, continue immediately to check for more
                Logger.debugLog(`Started ${tasksToStart.length} tasks, ${Object.keys(this.activeTasks).length} active`);
            } else if (Object.keys(this.activeTasks).length > 0) {
                // No new tasks, but some active, wait a short time and check again
                await new Promise(resolve => setTimeout(resolve, 100));
            } else {
                // No tasks at all, wait longer
                Logger.debugLog(`Task queue empty, waiting 500ms for potential async tasks`);
                await new Promise(resolve => setTimeout(resolve, 500));
                if (this.taskQueue.length === 0) {
                    break;
                }
            }
        }
        Logger.debugLog(`Event loop finished`);
    }
}
