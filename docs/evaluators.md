# Evaluator System

The evaluator system in this project provides automatic analysis and annotation of chunks generated during agent execution. Evaluators run in the background to add metadata and insights to conversation chunks, enhancing the system's ability to understand, moderate, and improve interactions.

In the context of AI-powered roleplaying games like "Who Stole My Arms!?", evaluators enable dynamic game mechanics by automatically tracking character states, analyzing player actions, and enriching storytelling with reactive elements.

## Overview

Evaluators are classes that implement the `Evaluator` interface and are automatically triggered when chunks are emitted by agents. They can perform lightweight analysis (like counting words) or complex LLM-based evaluations (like sentiment analysis). Annotations are stored in the chunk's `annotations` object using fully qualified domain names (FQDNs) as keys to prevent conflicts.

## How It Works

1. **Registration**: Evaluators are registered with the `EvaluatorManager` as groups: single evaluators or arrays for sequences
2. **Triggering**: When an agent calls `addChunk()`, chunk events are emitted
3. **Execution**: Evaluators run in nested parallel-sequential fashion:
   - Top-level groups execute in parallel
   - Evaluators within each group run sequentially
4. **Annotation**: Results are stored in `chunk.annotations[fqdn]`

## Sequences and Parallelism

The evaluator system uses nested arrays to define execution patterns:

- **Parallel Execution**: Top-level array elements (groups) run concurrently
- **Sequential Execution**: Within each group (inner array), evaluators run one after another
- **Group Types**:
  - Single evaluator: `[foo]` - runs alone in its group
  - Sequential group: `[foo, bar, baz]` - runs foo → bar → baz sequentially
  - Mixed configuration: `[[foo, bar], [baz, quux]]` - runs (foo → bar) and (baz → quux) in parallel

**Registration Examples**:
- `registerEvaluator(foo); registerEvaluator(bar); registerEvaluator(baz)` → `[[foo], [bar], [baz]]` → runs foo, bar, baz in parallel
- `registerEvaluator([foo, bar, baz])` → `[[foo, bar, baz]]` → runs foo → bar → baz sequentially
- `registerEvaluator([foo, bar]); registerEvaluator([baz, quux])` → `[[foo, bar], [baz, quux]]` → runs (foo → bar) and (baz → quux) in parallel

This enables reactive chains where dependent evaluators (e.g., tool invocation after detection) run sequentially, while independent chains execute in parallel.

## Evaluator Types

### SimpleEvaluator
- Uses synchronous functions for lightweight analysis
- Ideal for simple metrics like character/word counts
- Low overhead, fast execution
- Example: Counting characters and words in a message

### AgentEvaluator
- Uses full LLM agents for complex analysis
- Can perform tasks like sentiment analysis or content classification
- Asynchronous execution via task queue
- Cannot use agents that support continuation
- Example: Analyzing emotional tone or detecting inappropriate content

### Tool Integration Evaluators
- Specialized evaluators that enable automatic tool invocation from LLM responses
- Consist of detection and invocation phases for seamless tool calling
- Allow agents to use tools without explicit programming
- **ToolCallDetectionEvaluator**: Scans LLM output for tool call syntax and annotates detected calls
- **ToolInvocationEvaluator**: Executes detected tools and annotates results back to chunks

## Interface

All evaluators must implement:

```typescript
abstract class Evaluator {
    readonly fqdn: string;
    readonly supportedChunkTypes: ChunkType[];
    abstract evaluate(chunk: Chunk, arena: any, agent?: any): Promise<{annotation?: any, annotations?: Record<string, any>}>;
}
```

- `fqdn`: Unique identifier (e.g., "evaluators.LengthEvaluator")
- `supportedChunkTypes`: Array of chunk types this evaluator handles
- `evaluate()`: Method that returns annotation data

## What You Can Do With Evaluators

Evaluators enable various automated analysis capabilities:

### Content Analysis
- **Sentiment Detection**: Automatically flag positive/negative messages
- **Language Analysis**: Detect language, toxicity, or spam
- **Content Categorization**: Tag messages by topic or intent

### Quality Assurance
- **Length Monitoring**: Ensure responses meet minimum/maximum length requirements
- **Completeness Checks**: Verify if responses fully address queries
- **Grammar/Style Analysis**: Flag potential issues or suggest improvements

### Moderation & Safety
- **Content Moderation**: Detect and flag inappropriate content
- **Safety Checks**: Monitor for harmful requests or responses
- **Compliance**: Ensure outputs meet regulatory requirements

### Analytics & Insights
- **Usage Metrics**: Track conversation patterns and agent performance
- **User Behavior**: Analyze interaction patterns for UX improvements
- **Performance Monitoring**: Measure response quality over time

### State Management & Reactivity
- **Dynamic State Tracking**: Automatically update persistent state (e.g., character clothing, traits, or environment) based on conversation flow
- **Reactive Annotations**: Chain evaluators to create cascading updates, where one evaluator's output triggers others
- **Contextual Enrichment**: Enhance chunks with metadata from external sources or previous interactions

### Roleplaying Game Mechanics
- **Character State Tracking**: Automatically update character attributes, inventory, or status effects based on narrative flow
- **Narrative Analysis**: Detect plot developments, relationship changes, or environmental shifts
- **Player Action Validation**: Ensure actions comply with game rules or lore
- **Dynamic NPC Responses**: Adapt non-player character behavior based on conversation context

### Custom Analysis
- **Domain-Specific**: Create evaluators for specialized domains (e.g., legal, medical)
- **Business Logic**: Implement company-specific validation rules
- **Integration**: Connect to external services for advanced analysis

## Tool Integration via Evaluators

Tools in this system are implemented as evaluators that enable automatic tool calling from LLM responses. This architecture provides a clean separation between tool definition, detection, and execution, allowing agents to seamlessly invoke tools based on natural language instructions.

### How Tool Calling Works

1. **LLM Response Generation**: Agent generates response that may include tool call syntax
2. **Tool Detection**: `ToolCallDetectionEvaluator` scans for `<|tool_call|>...<\tool_call_end|>` patterns
3. **Annotation**: Detected calls are annotated on the chunk
4. **Tool Invocation**: `ToolInvocationEvaluator` executes the tools and captures results
5. **Result Annotation**: Tool outputs are annotated back for agent consumption

### Tool Call Syntax

LLMs are prompted to output tool calls in a structured format:

```
<|tool_call|>
{
  "name": "toolName",
  "parameters": {
    "param1": "value1",
    "param2": 42
  }
}
<|tool_call_end|>
```

### Evaluator Flow

- **ToolCallDetectionEvaluator**:
  - Supports: `ChunkType.LlmOutput`
  - Annotates: `{ toolCalls: [...], hasToolCalls: boolean }`
  - Detects multiple tool calls per chunk

- **ToolInvocationEvaluator**:
  - Depends on: ToolCallDetectionEvaluator annotations
  - Supports: `ChunkType.LlmOutput`
  - Annotates: `{ toolInvocations: [...], hasToolInvocations: boolean }`
  - Handles errors and partial failures gracefully

### Benefits

- **Natural Language Tool Use**: Agents can invoke tools via conversational instructions
- **Asynchronous Execution**: Tools run in parallel without blocking agent flow
- **Error Handling**: Robust error recovery and result annotation
- **Extensibility**: New tools integrate seamlessly without agent modification
- **Separation of Concerns**: Tools defined independently of agent logic

## Creating Custom Evaluators

### Simple Evaluator Example

```typescript
import { SimpleEvaluator } from './SimpleEvaluator';
import { ChunkType } from '../interfaces/AgentTypes';

const lengthEvaluator = new SimpleEvaluator(
    (chunk) => ({
        annotation: {
            chars: chunk.content.length,
            words: chunk.content.split(/\s+/).length
        }
    }),
    [ChunkType.Text],
    'evaluators.LengthEvaluator'
);
```

### Agent-Based Evaluator Example

```typescript
import { AgentEvaluator } from './AgentEvaluator';
import { SentimentAgent } from '../agents/SentimentAgent';

const sentimentEvaluator = new AgentEvaluator(
    SentimentAgent,
    streamingLLM,
    [ChunkType.Text],
    'evaluators.SentimentEvaluator'
);
```

## Integration

Evaluators are automatically integrated when agents add chunks, respecting the nested execution structure:

```typescript
// Register parallel groups: one sequence + one single
evaluatorManager.registerEvaluator([toolCallDetectionEvaluator, toolInvocationEvaluator]);
evaluatorManager.registerEvaluator(lengthEvaluator);

// Results in: [[toolCallDetectionEvaluator, toolInvocationEvaluator], [lengthEvaluator]]
// Execution: (detection → invocation) || lengthEvaluator

// In an agent
this.addChunk({
    type: ChunkType.Text,
    content: "Hello world!",
    timestamp: Date.now()
});

// Evaluators run automatically:
// - toolCallDetectionEvaluator runs first in its sequence
// - toolInvocationEvaluator runs after, using detection results
// - lengthEvaluator runs in parallel
// Annotations: chunk.annotations['evaluators.ToolInvocationEvaluator'] = {...}, etc.
```

## Management

The `EvaluatorManager` singleton handles:
- Loading and initializing evaluators
- Providing access to evaluator instances
- Managing evaluator lifecycle

Access via:
```typescript
const evaluatorManager = EvaluatorManager.getInstance();
const evaluators = evaluatorManager.getEvaluators();
```