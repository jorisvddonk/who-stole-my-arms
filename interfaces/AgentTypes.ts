export enum ChunkType {
    Input = 'input',
    LlmOutput = 'llmOutput',
    ToolOutput = 'toolOutput',
    AgentOutput = 'agentOutput',
    Error = 'error',
    Data = 'data'
}

export enum TaskType {
    Regular = 'regular',
    Evaluator = 'evaluator'
}

export interface Chunk {
    type: ChunkType;
    content: string;
    processed: boolean;
    messageId?: string;
    annotations?: Record<string, any>;
}

export interface Task {
    id: string;
    agent_name: string;
    input: any;
    parent_task_id: string | null;
    scratchpad: Chunk[];
    retryCount: number;
    executionCount?: number;
    taskType?: TaskType;
    onComplete?: (result: string | {content: string, annotation?: any, annotations?: Record<string, any>}) => void;
}