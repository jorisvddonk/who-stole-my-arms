import { EventEmitter } from 'node:events';
import { LLMAgent } from '../core/LLMAgent';
import { Chunk, ChunkType, Task, TaskType } from '../../interfaces/AgentTypes';
import { StreamingLLMInvoke } from '../../interfaces/LLMInvoke';
import { Evaluator } from '../core/Evaluator';
import { Logger } from '../logging/debug-logger';
import { Arena } from '../core/Arena';

/**
 * Options for copying chunks from evaluated task back to calling agent.
 */
export enum CopyChunksOption {
    /** Copy no chunks (default) */
    NONE = 'none',
    /** Copy only the last LLMOutput chunk */
    LAST_LLMOUTPUT = 'last_llmoutput',
    /** Copy all LLMOutput chunks */
    ALL_LLMOUTPUT = 'all_llmoutput'
}

/**
 * Evaluator that uses a full LLM agent to analyze chunks.
 * Creates tasks for the specified agent class to evaluate chunks asynchronously.
 */
export class AgentEvaluator extends Evaluator {
    /** Fully qualified domain name for this evaluator */
    readonly fqdn: string;
    /** Array of chunk types that this evaluator can process */
    readonly supportedChunkTypes: ChunkType[];
    /** The agent factory function to create the agent for evaluation */
    private agentFactory: (streamingLLM: StreamingLLMInvoke, arena: any) => LLMAgent;
    /** The streaming LLM interface */
    private streamingLLM: StreamingLLMInvoke;
    /** Optional precondition function that must return true for evaluation to proceed */
    private preconditionFunction?: (chunk: Chunk, arena: any, agent?: any) => Promise<boolean>;
    /** Option for copying chunks from evaluated task back to calling agent */
    private copyChunks: CopyChunksOption;
    /** Event emitter for handling evaluator events */
    eventEmitter: EventEmitter = new EventEmitter();

      /**
       * Creates a new AgentEvaluator instance.
       * @param agentFactory The agent factory function to create the agent for evaluation.
       * @param streamingLLM The streaming LLM interface to pass to the agent.
       * @param supportedChunkTypes Array of chunk types this evaluator can process.
       * @param preconditionFunction Optional async function that must return true for evaluation to proceed.
       * @param copyChunks Option for copying chunks from evaluated task back to calling agent (default: NONE).
       * @param fqdn Optional FQDN override for this evaluator.
       */
     constructor(
         agentFactory: (streamingLLM: StreamingLLMInvoke, arena: any) => LLMAgent,
         streamingLLM: StreamingLLMInvoke,
         supportedChunkTypes: ChunkType[],
         preconditionFunction?: (chunk: Chunk, arena: any, agent?: any) => Promise<boolean>,
         copyChunks: CopyChunksOption = CopyChunksOption.NONE,
         fqdn?: string
     ) {
        super();
        this.agentFactory = agentFactory;
        this.streamingLLM = streamingLLM;
        this.supportedChunkTypes = supportedChunkTypes;
        this.preconditionFunction = preconditionFunction;
        this.copyChunks = copyChunks;
         this.fqdn = fqdn || `evaluators.${this.constructor.name}`;

         // Validate that the agent doesn't support continuation
         const testAgent = this.agentFactory(this.streamingLLM, null);
         if (testAgent.supportsContinuation) {
             throw new Error(`AgentEvaluator cannot use agents with supportsContinuation=true`);
         }

    }

    /**
     * Evaluates a chunk by creating an agent task and waiting for completion.
     * @param chunk The chunk to evaluate.
     * @param arena The arena context for task management.
     * @param agent The agent that emitted the chunk.
     * @returns Promise resolving to annotation data.
     */
    async evaluate(chunk: Chunk, arena: any, agent?: any): Promise<{annotation?: any, annotations?: Record<string, any>}> {
        // Check precondition if set
        if (this.preconditionFunction) {
            const shouldEvaluate = await this.preconditionFunction(chunk, arena, agent);
            Logger.debugLog(`[${this.fqdn}] Precondition result: ${shouldEvaluate}`);
            if (!shouldEvaluate) {
                Logger.debugLog(`[${this.fqdn}] Precondition failed, skipping evaluation`);
                return {};
            }
        }

        // Create the agent to check if it's registered
        const agentInstance = this.agentFactory(this.streamingLLM, arena);
        if (!arena.agents[agentInstance.constructor.name]) {
            // Agent not registered, resolve with error
            const error = { content: `<|error|>Agent ${agentInstance.constructor.name} not registered for evaluation<|error_end|>` };
            return { annotation: error };
        }

         // Create task with chunk as input
         const parentTaskId = agent?.currentTask?.id || null;
         Logger.debugLog(`[${this.fqdn}] Creating task with parent_task_id: ${parentTaskId}`);
         const task: Task = {
             id: `eval_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
             agent_name: agentInstance.constructor.name,
             input: chunk,
            parent_task_id: parentTaskId,
            scratchpad: [],
            retryCount: 0,
            executionCount: 0,
            taskType: TaskType.Evaluator,
            sessionId: arena.sessionId,
            onComplete: (result) => {
                Logger.debugLog(`[${this.fqdn}] Evaluator task ${task.id} completed with result: ${JSON.stringify(result)}`);

                // Emit results for frontend consumption
                arena.eventEmitter.emit('evaluatorResult', {
                    evaluatorName: this.fqdn,
                    taskId: task.id,
                    result,
                    agentName: agent?.constructor.name
                });

                // Copy chunks back to calling agent if requested
                if (this.copyChunks !== CopyChunksOption.NONE) {
                    const completedTask = arena.taskStore[task.id];
                    Logger.debugLog(`[${this.fqdn}] CopyChunks: task ${task.id} in store: ${!!completedTask}`);
                    if (completedTask && completedTask.scratchpad) {
                        const llmOutputChunks = completedTask.scratchpad.filter((c: Chunk) => c.type === ChunkType.LlmOutput);
                        Logger.debugLog(`[${this.fqdn}] CopyChunks: found ${llmOutputChunks.length} LLMOutput chunks in task ${task.id}`);

                        // Emit chunks as events for frontend
                        for (const chunk of llmOutputChunks) {
                            arena.eventEmitter.emit('evaluatorChunk', {
                                evaluatorName: this.fqdn,
                                taskId: task.id,
                                chunk: {
                                    id: chunk.id,
                                    type: chunk.type,
                                    content: chunk.content,
                                    processed: chunk.processed
                                }
                            });
                        }

                        // Also try to copy to parent task if it exists and is still active
                        if (task.parent_task_id) {
                            const parentTask = arena.taskStore[task.parent_task_id];
                            if (parentTask) {
                                Logger.debugLog(`[${this.fqdn}] Parent task ${parentTask.id} found, copying chunks`);
                                if (this.copyChunks === CopyChunksOption.ALL_LLMOUTPUT) {
                                    for (const chunk of llmOutputChunks) {
                                        const copiedChunk = { ...chunk, id: Arena.generateId() };
                                        parentTask.scratchpad.push(copiedChunk);
                                        Logger.debugLog(`[${this.fqdn}] Copied chunk ${chunk.id} to parent task ${parentTask.id}`);
                                    }
                                } else if (this.copyChunks === CopyChunksOption.LAST_LLMOUTPUT && llmOutputChunks.length > 0) {
                                    const lastChunk = llmOutputChunks[llmOutputChunks.length - 1];
                                    const copiedChunk = { ...lastChunk, id: Arena.generateId() };
                                    parentTask.scratchpad.push(copiedChunk);
                                    Logger.debugLog(`[${this.fqdn}] Copied last chunk ${lastChunk.id} to parent task ${parentTask.id}`);
                                }
                            } else {
                                Logger.debugLog(`[${this.fqdn}] Parent task ${task.parent_task_id} not found in taskStore`);
                            }
                        }
                    } else {
                        Logger.debugLog(`[${this.fqdn}] CopyChunks: no completed task or scratchpad found`);
                    }
                }
            }
        };

        arena.queueTask(task, 'evaluator');
        Logger.debugLog(`[${this.fqdn}] Created and queued evaluator task ${task.id} for ${agentInstance.constructor.name}`);

        // Add task to taskStore immediately so it's available for inspection
        arena.taskStore[task.id] = task;
        Logger.debugLog(`[${this.fqdn}] Added task ${task.id} to taskStore`);

        // Return immediately - task runs asynchronously
        return {};
    }


}