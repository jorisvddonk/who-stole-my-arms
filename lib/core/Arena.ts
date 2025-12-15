import { EventEmitter } from 'node:events';
import { LLMAgent, ChunkType, Chunk, Task, Tool } from './LLMAgent';
import { AgentManager } from '../agents/AgentManager';
import { Logger, DEBUG_COLOR, GLOBAL_COLOR, AGENT_COLOR, TOOL_COLOR, YELLOW, BRIGHT_YELLOW, RESET } from '../logging/debug-logger';

export class Arena {
    eventEmitter: EventEmitter;

    streamingLLM: any;

    // Agents that are always allowed to be called, even if the calling agent has registered agents
    alwaysAllowedAgents: string[] = ['ErrorAgent'];

    // Registry of available agents that can be called. These are only available for agents that don't have registered agents themselves.
    agents: Record<string, LLMAgent>;

    taskQueue: Task[] = [];

    taskStore: Record<string, Task> = {};

    invocationLog: Array<{id: string, type: 'agent' | 'tool', name: string, parent_id: string | null, params?: any, result?: any}> = [];

    currentContinuationTask: Task | null = null;

    errorCount: number = 0;

    dataChunks: Chunk[] = [];

    constructor(streamingLLM: any, agentManager: AgentManager) {
        this.streamingLLM = streamingLLM;
        this.eventEmitter = new EventEmitter();
        this.agents = agentManager.getAgents();
        // Set arena on agents and wire events
        for (const agent of Object.values(this.agents)) {
            (agent as any).arena = this;
            this.wireAgentEventEmitter(agent);
        }
    }



    updateStreamingLLM(newStreamingLLM: any) {
        this.streamingLLM = newStreamingLLM;
        for (const agent of Object.values(this.agents)) {
            agent.setStreamingLLM(newStreamingLLM);
        }
    }

    public wireAgentEventEmitter(agent: LLMAgent) {
        // wire up logging
        agent.eventEmitter.on('chunk', (chunk: Chunk) => {
            Logger.globalLog(`Chunk from ${AGENT_COLOR}${agent.constructor.name}${RESET}: ${chunk.type} - ${chunk.content}`);
            this.eventEmitter.emit('chunk', {agentName: agent.constructor.name, chunk});
        });
        agent.eventEmitter.on('token', (token: string) => {
            Logger.globalLog(`Token from ${AGENT_COLOR}${agent.constructor.name}${RESET}: ${token}`);
            this.eventEmitter.emit('token', token);
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

    removeChunksByMessageId(messageId: string) {
        for (const taskId in this.taskStore) {
            const task = this.taskStore[taskId];
            task.scratchpad = task.scratchpad.filter(chunk => chunk.messageId !== messageId);
        }
    }

    static generateId(): string {
        return Math.random().toString(36).substring(2, 11);
    }

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

    async run_agent(task: Task): Promise<{ response: string; agent: LLMAgent }> {
        if (!this.invocationLog.some(inv => inv.id === task.id)) {
            this.invocationLog.push({id: task.id, type: 'agent', name: task.agent_name, parent_id: task.parent_task_id, params: task.input});
        }

        const agent = this.agents[task.agent_name] || (task.agent_name === 'ErrorAgent' ? new ErrorAgent(this.streamingLLM, this) : null);
        if (!agent) {
            Logger.debugLog(`Unknown agent: ${AGENT_COLOR}${task.agent_name}${RESET}`);
            throw new Error("Unknown agent");
        }

        try {
            const response = await agent.run(task);

            return { response, agent };
        } catch (e) {
            if (task.agent_name === 'ErrorAgent') {
                Logger.debugLog(`ErrorAgent failed, using fallback`);
                const fallback = "<|error|>An unexpected error occurred during processing.<|error_end|>";
                return { response: fallback, agent };
            }
            throw e;
        }
    }

    return_result_to_parent(task: Task, output: string) {
        Logger.debugLog(`Returning result from task ${task.id} (${AGENT_COLOR}${task.agent_name}${RESET}): ${output}`);
        if (task.parent_task_id === null) {
            console.log(`${YELLOW}FINAL OUTPUT:${RESET} ${BRIGHT_YELLOW}${output}${RESET}`);
            if (process.argv.includes('--debug')) {
                this.printInvocationTree();
            }
            return;
        }
        const parent = this.taskStore[task.parent_task_id];
        Logger.debugLog(`Adding result to parent task ${parent.id} (${AGENT_COLOR}${parent.agent_name}${RESET}) scratchpad`);
        const agentResult = `<|agent_result|>${JSON.stringify(output)}<|agent_result_end|>`;
        const agentChunk = { type: ChunkType.AgentOutput, content: agentResult, processed: true };
        const parentAgent = this.agents[parent.agent_name];
        parentAgent.addChunk(parent, agentChunk);
        this.taskQueue.push(parent);
        Logger.debugLog(`Re-queued parent task ${parent.id} with agent result chunk: ${agentResult}`);
    }

    printInvocationTree() {
        console.log("\n\x1b[1;36m======================================== INVOCATION TREE SUMMARY ========================================\x1b[0m");

        const buildTree = (parentId: string | null, depth: number = 0): void => {
            const children = this.invocationLog.filter((inv: any) => inv.parent_id === parentId);
            for (const child of children) {
                const indent = "  ".repeat(depth);
                const typeLabel = child.type === 'agent' ? '\x1b[1;34mAgent\x1b[0m' : '\x1b[1;33mTool \x1b[0m';
                const nameColor = child.type === 'agent' ? '\x1b[1;32m' : '\x1b[1;35m';
                const paramsColor = child.type === 'agent' ? '\x1b[32m' : '\x1b[35m';
                const retryInfo = child.type === 'agent' ? ` (retries: ${this.taskStore[child.id]?.retryCount || 0})` : '';
                const namePart = `${indent}${typeLabel}: ${nameColor}${child.name}\x1b[0m${retryInfo}`;
                let paramsText = child.params ? JSON.stringify(child.params) : '';
                if (paramsText.length > 50) {
                    paramsText = paramsText.substring(0, 47) + '...';
                }
                const paramsStr = child.params ? `${paramsColor}${paramsText}\x1b[0m` : '';
                const namePadding = ' '.repeat(Math.max(0, 35 - namePart.replace(/\x1b\[[0-9;]*m/g, '').length));  // Adjusted for retry info
                const paramsPadding = ' '.repeat(Math.max(0, 45 - paramsStr.replace(/\x1b\[[0-9;]*m/g, '').length));
                console.log(`${namePart}${namePadding}${paramsStr}${paramsPadding}(\x1b[90m${child.id}\x1b[0m)`);
                buildTree(child.id, depth + 1);
            }
        };

        buildTree(null, 0);
        const errorStyle = this.errorCount > 0 ? '\x1b[1;31m' : '\x1b[31m';
        console.log(`${errorStyle}Errors: ${this.errorCount}\x1b[0m`);
        console.log("\x1b[1;36m========================================================================================================\x1b[0m\n");
    }

    async run_event_loop(isInteractive: boolean = false) {
        Logger.debugLog(`Starting event loop with ${this.taskQueue.length} tasks in queue`);
        while (this.taskQueue.length > 0) {
            const task = this.taskQueue.shift()!;
            task.executionCount = (task.executionCount || 0) + 1;
            Logger.debugLog(`Processing task ${task.id} (${AGENT_COLOR}${task.agent_name}${RESET}) - execution ${task.executionCount}`);
            let hasNewErrors = false;
            const { response, agent } = await this.run_agent(task);
            Logger.debugLog(`Agent response: ${response}`);

            // Add the response as a new chunk
            const newChunk = { type: ChunkType.LlmOutput, content: response, processed: false };
            agent.addChunk(task, newChunk);

                // Check the last chunk for parsing
                const lastChunk = task.scratchpad[task.scratchpad.length - 1];
                if (lastChunk.type === ChunkType.LlmOutput && !lastChunk.processed) {
                    let toolCalls: Array<{ name: string; parameters: any }> = [];
                    let agentCalls: Array<{ name: string; input: any }> = [];
                    try {
                        toolCalls = Arena.parseToolCalls(lastChunk.content);
                    } catch (e) {
                        const errorChunk = { type: ChunkType.Error, content: `Parse error in toolCalls: ${e}`, processed: true };
                        agent.addChunk(task, errorChunk);
                        this.eventEmitter.emit('parseError', { type: 'toolCalls', error: e, content: lastChunk.content });
                        hasNewErrors = true;
                    }
                    try {
                        agentCalls = Arena.parseAgentCalls(lastChunk.content);
                    } catch (e) {
                        const errorChunk = { type: ChunkType.Error, content: `Parse error in agentCalls: ${e}`, processed: true };
                        agent.addChunk(task, errorChunk);
                        this.eventEmitter.emit('parseError', { type: 'agentCalls', error: e, content: lastChunk.content });
                        hasNewErrors = true;
                    }

                let hasToolCalls = false;

                // Process tool calls
                for (const call of toolCalls) {
                    agent.eventEmitter.emit('toolCall', call);
                    Logger.debugLog(`Executing tool call: ${TOOL_COLOR}${call.name}${RESET} with params: ${JSON.stringify(call.parameters)}`);
                    const toolId = `tool_${task.id}_${call.name}`;
                    if (!this.invocationLog.some(inv => inv.id === toolId)) {
                        this.invocationLog.push({id: toolId, type: 'tool', name: call.name, parent_id: task.id, params: call.parameters});
                    }
                    const tool = agent.tools[call.name];
                    let toolResult: any;
                     if (tool) {
                         try {
                              toolResult = await tool.run(call.parameters, { arena: this, task });
                             Logger.debugLog(`Tool ${TOOL_COLOR}${call.name}${RESET} output: ${JSON.stringify(toolResult)}`);
                             const toolResultStr = `<|tool_result|>${JSON.stringify(toolResult)}<|tool_result_end|>`;
                             const toolChunk = { type: ChunkType.ToolOutput, content: toolResultStr, processed: true };
                             agent.addChunk(task, toolChunk);
                             hasToolCalls = true;
                             Logger.debugLog(`Tool result: ${toolResultStr}`);
                         } catch (e) {
                             const errorContent = `<|error|>Tool ${call.name} failed: ${e.message || e}<|error_end|>`;
                             const errorChunk = { type: ChunkType.Error, content: errorContent, processed: true };
                             agent.addChunk(task, errorChunk);
                             agent.eventEmitter.emit('parseError', { type: 'toolExecution', error: e, content: call.name });
                             toolResult = { error: e.message || e };
                             Logger.debugLog(`Tool ${TOOL_COLOR}${call.name}${RESET} failed: ${e}`);
                             hasNewErrors = true;
                         }
                     } else {
                        const errorContent = `<|error|>Unknown tool: ${call.name}<|error_end|>`;
                        const errorChunk = { type: ChunkType.Error, content: errorContent, processed: true };
                        agent.addChunk(task, errorChunk);
                        agent.eventEmitter.emit('parseError', { type: 'toolExecution', error: errorContent, content: call.name });
                        toolResult = "unknown tool";
                        Logger.debugLog(`Tool ${TOOL_COLOR}${call.name}${RESET} not found, output: ${JSON.stringify(toolResult)}`);
                        hasNewErrors = true;                 
                    }
                }

                // Process agent calls
                for (const call of agentCalls) {
                    if (agent.registeredAgents[call.name] || this.alwaysAllowedAgents.includes(call.name) && this.agents[call.name] || (Object.keys(agent.registeredAgents).length === 0 && this.agents[call.name])) {
                        agent.eventEmitter.emit('agentCall', call);
                        Logger.debugLog(`Creating agent call: ${AGENT_COLOR}${call.name}${RESET} with input: ${JSON.stringify(call.input)}`);
                        const childTask: Task = {
                            id: Arena.generateId(),
                            agent_name: call.name,
                            input: call.input,
                            parent_task_id: task.id,
                            scratchpad: [{ type: ChunkType.Input, content: JSON.stringify(call.input), processed: true }],
                            retryCount: 0,
                            executionCount: 0
                        };
                        this.taskStore[childTask.id] = childTask;
                        this.taskQueue.push(childTask);
                        Logger.debugLog(`Created child task ${childTask.id} (${AGENT_COLOR}${childTask.agent_name}${RESET})`);
                    } else {
                        const errorContent = `<|error|>Unknown agent: ${call.name}<|error_end|>`;
                        const errorChunk = { type: ChunkType.Error, content: errorContent, processed: true };
                        agent.addChunk(task, errorChunk);
                        agent.eventEmitter.emit('parseError', { type: 'agentExecution', error: errorContent, content: call.name });
                        hasNewErrors = true;
                        Logger.debugLog(`Agent ${AGENT_COLOR}${call.name}${RESET} not found`);
                    }
                }

                lastChunk.processed = true;

                if (hasNewErrors) {
                    if (task.retryCount < 3 && task.executionCount < 10) {
                        task.retryCount++;
                        this.taskQueue.push(task);
                        Logger.debugLog(`Re-queued task ${task.id} for retry (${task.retryCount}/3, executions: ${task.executionCount})`);
                    } else {
                        const reason = task.executionCount >= 10 ? 'max executions reached' : 'max retries reached';
                        const errorDetails = `${reason}\n${task.scratchpad.filter(c => c.type === ChunkType.Error).map(c => c.content).join('\n')}`;
                        const errorTask: Task = {
                            id: Arena.generateId(),
                            agent_name: 'ErrorAgent',
                            input: errorDetails,
                            parent_task_id: task.id,
                            scratchpad: [{ type: ChunkType.Input, content: errorDetails, processed: true }],
                            retryCount: 0,
                            executionCount: 0
                        };
                        this.taskStore[errorTask.id] = errorTask;
                        this.taskQueue.push(errorTask);
                        if (this.currentContinuationTask?.id === task.id) {
                            this.currentContinuationTask = null;
                        }
                        Logger.debugLog(`Created ErrorAgent task ${errorTask.id} for exhausted task ${task.id} (${reason})`);
                    }
                } else if (hasToolCalls) {
                    // Re-queue task
                    this.taskQueue.push(task);
                    Logger.debugLog(`Re-queued task ${task.id} after tool calls`);
                } else if (toolCalls.length === 0 && agentCalls.length === 0) {
                    const agent = this.agents[task.agent_name];
                    if (agent && agent.supportsContinuation && isInteractive) {
                        Logger.debugLog(`Continuation agent task ${task.id} provided response, waiting for more input`);
                        // Do not complete or return result; leave the task for continuation
                    } else {
                        // No calls, final result
                        Logger.debugLog(`Task ${task.id} completed with final result: ${response}`);
                        this.return_result_to_parent(task, response);
                    }
                } else {
                    // Has agent calls, parent waits for child
                    Logger.debugLog(`Task ${task.id} waiting for child agents`);
                }
            } else {
                Logger.debugLog(`Last chunk already processed or not llmOutput`);
            }

            Logger.debugLog(`Queue now has ${this.taskQueue.length} tasks`);
        }
        Logger.debugLog(`Event loop finished`);
    }
}