import { Logger, TOOL_COLOR, RESET } from '../logging/debug-logger';
import { ChunkType, Chunk, Task } from '../../interfaces/AgentTypes';

/**
 * Abstract base class for tools that can be used by LLM agents.
 * Tools provide functionality to execute specific actions and manage data chunks.
 */
export abstract class Tool {
    abstract readonly name: string;
    abstract readonly description: string;
    abstract readonly parameters: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
    abstract readonly prompt?: string;
    public fqdn: string;

    constructor() {
        this.fqdn = `tools.${this.constructor.name}`;
    }

    /**
     * Executes the tool with the given parameters.
     * @param parameters The input parameters for the tool.
     * @param context Optional context containing arena and task references.
     * @returns Promise resolving to the tool's result.
     */
    abstract run(parameters: any, context?: { arena: any, task: Task }): Promise<any | { result: any, annotation?: any, annotations?: Record<string, any> }>;

    /**
     * Writes data to the task's scratchpad as a data chunk.
     * @param task The task to which the data chunk will be added.
     * @param data The data to store.
     * @param fqdn Optional FQDN to use instead of the tool's default.
     */
    public writeTaskDataChunk(task: Task, data: any, fqdn?: string): void {
        const effectiveFqdn = fqdn || this.fqdn;
        if (!effectiveFqdn) {
            throw new Error('Tool FQDN not set');
        }
        Logger.globalLog(`${TOOL_COLOR}${this.constructor.name}${RESET} writing task data chunk: ${JSON.stringify(data)}`);
        const chunk: Chunk = {
            type: ChunkType.Data,
            content: JSON.stringify({ fqdn: effectiveFqdn, data }),
            processed: true
        };
        task.scratchpad.push(chunk);
    }

    /**
     * Writes data to the arena's session-global data chunks.
     * @param data The data to store.
     * @param context Context containing the arena reference.
     * @param fqdn Optional FQDN to use instead of the tool's default.
     */
    public writeSessionDataChunk(data: any, context: { arena: any }, fqdn?: string): void {
        const effectiveFqdn = fqdn || this.fqdn;
        if (!effectiveFqdn) {
            throw new Error('Tool FQDN not set');
        }
        Logger.globalLog(`${TOOL_COLOR}${this.constructor.name}${RESET} writing session data chunk: ${JSON.stringify(data)}`);
        const chunk: Chunk = {
            type: ChunkType.Data,
            content: JSON.stringify({ fqdn: effectiveFqdn, data }),
            processed: true
        };
        context.arena.dataChunks.push(chunk);
    }

    /**
     * Retrieves data chunks from the task's scratchpad.
     * @param task The task from which to retrieve data chunks.
     * @param fqdn Optional FQDN to filter by instead of the tool's default.
     * @returns Array of data objects stored by the specified FQDN in the task.
     */
    public getTaskDataChunks(task: Task, fqdn?: string): any[] {
        const effectiveFqdn = fqdn || this.fqdn;
        if (!effectiveFqdn) {
            throw new Error('Tool FQDN not set');
        }
        return task.scratchpad
            .filter((c: Chunk) => c.type === ChunkType.Data)
            .map((c: Chunk) => {
                try {
                    const parsed = JSON.parse(c.content);
                    return parsed.fqdn === effectiveFqdn ? parsed.data : null;
                } catch (e) {
                    return null;
                }
            })
            .filter((d: any) => d !== null);
    }

    /**
     * Retrieves data chunks from the arena's session-global storage.
     * @param context Context containing the arena reference.
     * @param fqdn Optional FQDN to filter by instead of the tool's default.
     * @returns Array of data objects stored by the specified FQDN in the session.
     */
    public getSessionDataChunks(context: { arena: any }, fqdn?: string): any[] {
        const effectiveFqdn = fqdn || this.fqdn;
        if (!effectiveFqdn) {
            throw new Error('Tool FQDN not set');
        }
        return context.arena.dataChunks
            .filter((c: Chunk) => c.type === ChunkType.Data)
            .map((c: Chunk) => {
                try {
                    const parsed = JSON.parse(c.content);
                    return parsed.fqdn === effectiveFqdn ? parsed.data : null;
                } catch (e) {
                    return null;
                }
            })
            .filter((d: any) => d !== null);
    }

    /**
     * Retrieves all data chunks from session-global and task-scoped storage.
     * @param task The task to include task-scoped data from.
     * @param context Context containing the arena reference.
     * @param fqdn Optional FQDN to filter by instead of the tool's default.
     * @returns Array of all data objects stored by the specified FQDN.
     */
    public getAllDataChunks(task: Task, context: { arena: any }, fqdn?: string): any[] {
        const sessionData = this.getSessionDataChunks(context, fqdn);
        const taskData = this.getTaskDataChunks(task, fqdn);
        return [...sessionData, ...taskData];
    }

    /**
     * Annotates a chunk with data under the specified FQDN.
     * @param chunk The chunk to annotate.
     * @param annotation The annotation data.
     * @param fqdn Optional FQDN to use instead of the tool's default.
     */
    public writeChunkAnnotation(chunk: Chunk, annotation: any, fqdn?: string): void {
        const effectiveFqdn = fqdn || this.fqdn;
        if (!effectiveFqdn) {
            throw new Error('Tool FQDN not set');
        }
        Logger.globalLog(`${TOOL_COLOR}${this.constructor.name}${RESET} annotating chunk: ${JSON.stringify(annotation)} with fqdn ${effectiveFqdn}`);
        if (!chunk.annotations) {
            chunk.annotations = {};
        }
        chunk.annotations[effectiveFqdn] = annotation;
    }

    /**
     * Retrieves annotations from a chunk.
     * @param chunk The chunk to retrieve annotations from.
     * @param fqdn Optional FQDN to filter by instead of the tool's default. If not provided, returns the full annotations map.
     * @returns The annotation value if fqdn is specified, or the full annotations map.
     */
    public getChunkAnnotation(chunk: Chunk, fqdn?: string): any | Record<string, any> {
        if (fqdn) {
            const effectiveFqdn = fqdn || this.fqdn;
            if (!effectiveFqdn) {
                throw new Error('Tool FQDN not set');
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
}