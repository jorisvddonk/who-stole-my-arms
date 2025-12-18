import { EventEmitter } from 'node:events';
import { LLMAgent } from '../core/LLMAgent';
import { Chunk, ChunkType, Task, TaskType } from '../../interfaces/AgentTypes';
import { StreamingLLMInvoke } from '../../interfaces/LLMInvoke';
import { Evaluator } from '../core/Evaluator';

/**
 * Evaluator that uses a full LLM agent to analyze chunks.
 * Creates tasks for the specified agent class to evaluate chunks asynchronously.
 */
export class AgentEvaluator extends Evaluator {
    /** Fully qualified domain name for this evaluator */
    readonly fqdn: string;
    /** Array of chunk types that this evaluator can process */
    readonly supportedChunkTypes: ChunkType[];
    /** The agent class constructor to use for evaluation */
    private agentClass: new (streamingLLM: StreamingLLMInvoke, arena: any) => LLMAgent;
    /** The streaming LLM interface */
    private streamingLLM: StreamingLLMInvoke;
    /** Event emitter for handling evaluator events */
    eventEmitter: EventEmitter = new EventEmitter();

    /**
     * Creates a new AgentEvaluator instance.
     * @param agentClass The agent class constructor to use for evaluation.
     * @param streamingLLM The streaming LLM interface to pass to the agent.
     * @param supportedChunkTypes Array of chunk types this evaluator can process.
     * @param fqdn Optional FQDN override for this evaluator.
     */
    constructor(
        agentClass: new (streamingLLM: StreamingLLMInvoke, arena: any) => LLMAgent,
        streamingLLM: StreamingLLMInvoke,
        supportedChunkTypes: ChunkType[],
        fqdn?: string
    ) {
        super();
        this.agentClass = agentClass;
        this.streamingLLM = streamingLLM;
        this.supportedChunkTypes = supportedChunkTypes;
        this.fqdn = fqdn || `evaluators.${this.constructor.name}`;

        // Validate that the agent class doesn't support continuation
        const testAgent = new this.agentClass(this.streamingLLM, null);
        if (testAgent.supportsContinuation) {
            throw new Error(`AgentEvaluator cannot use agents with supportsContinuation=true: ${agentClass.name}`);
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
        return new Promise((resolve) => {
            // Create task with chunk as input
            const task: Task = {
                id: `eval_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                agent_name: this.agentClass.name,
                input: chunk,
                parent_task_id: agent?.currentTask?.id || null,
                scratchpad: [],
                retryCount: 0,
                executionCount: 0,
                taskType: TaskType.Evaluator,
                onComplete: (result) => {
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

            arena.taskStore[task.id] = task;
            arena.taskQueue.push(task);
        });
    }
}