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

        return new Promise((resolve) => {
            // Create task with chunk content as input
            const task: Task = {
                id: `eval_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                agent_name: agentInstance.constructor.name,
                input: chunk.content,
                parent_task_id: agent?.currentTask?.id || null,
                scratchpad: [],
                retryCount: 0,
                executionCount: 0,
                taskType: TaskType.Evaluator,
                sessionId: arena.sessionId,
                onComplete: (result) => {
                    Logger.debugLog(`[${this.fqdn}] Evaluator task ${task.id} completed with result`);

                    // Copy chunks back to calling agent if requested
                    if (this.copyChunks !== CopyChunksOption.NONE && agent) {
                        const completedTask = arena.taskStore[task.id];
                        if (completedTask && completedTask.scratchpad) {
                            const llmOutputChunks = completedTask.scratchpad.filter((c: Chunk) => c.type === ChunkType.LlmOutput);

                            if (this.copyChunks === CopyChunksOption.ALL_LLMOUTPUT) {
                                // Copy all LLMOutput chunks
                                for (const chunk of llmOutputChunks) {
                                    const copiedChunk = { ...chunk, id: Arena.generateId() }; // Generate new ID
                                    agent.addChunk(agent.currentTask, copiedChunk);
                                    Logger.debugLog(`[${this.fqdn}] Copied LLMOutput chunk ${chunk.id} to calling agent`);
                                }
                            } else if (this.copyChunks === CopyChunksOption.LAST_LLMOUTPUT && llmOutputChunks.length > 0) {
                                // Copy only the last LLMOutput chunk
                                const lastChunk = llmOutputChunks[llmOutputChunks.length - 1];
                                const copiedChunk = { ...lastChunk, id: Arena.generateId() };
                                agent.addChunk(agent.currentTask, copiedChunk);
                                Logger.debugLog(`[${this.fqdn}] Copied last LLMOutput chunk ${lastChunk.id} to calling agent`);
                            }
                        }
                    }

                    if (typeof result === 'string') {
                        // Parse as JSON if possible
                        try {
                            const parsed = JSON.parse(result);
                            resolve({ annotation: parsed });
                        } catch {
                            resolve({ annotation: result });
                        }
                    } else {
                        // Return the full result object
                        resolve(result);
                    }
                }
            };

            Logger.debugLog(`[${this.fqdn}] Created evaluator task ${task.id} for ${agentInstance.constructor.name}`);

            arena.taskStore[task.id] = task;
            arena.queueTask(task, 'evaluator');
        });
    }
}