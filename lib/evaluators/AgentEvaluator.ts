import { EventEmitter } from 'node:events';
import { Chunk, ChunkType, LLMAgent, Task, TaskType } from '../core/LLMAgent';
import { StreamingLLMInvoke } from '../../interfaces/LLMInvoke';
import { Evaluator } from '../core/Evaluator';

export class AgentEvaluator extends Evaluator {
    readonly fqdn: string;
    readonly supportedChunkTypes: ChunkType[];
    private agentClass: new (streamingLLM: StreamingLLMInvoke, arena: any) => LLMAgent;
    private streamingLLM: StreamingLLMInvoke;
    eventEmitter: EventEmitter = new EventEmitter();

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

    async evaluate(chunk: Chunk, arena: any): Promise<{annotation?: any, annotations?: Record<string, any>}> {
        return new Promise((resolve) => {
            // Create task with chunk as input
            const task: Task = {
                id: `eval_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                agent_name: this.agentClass.name,
                input: chunk,
                parent_task_id: null,
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