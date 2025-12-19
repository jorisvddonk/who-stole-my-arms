# Evaluator System

The evaluator system in this project provides automatic analysis and annotation of chunks generated during agent execution. Evaluators run in the background to add metadata and insights to conversation chunks, enhancing the system's ability to understand, moderate, and improve interactions.

In the context of AI-powered roleplaying games like "Who Stole My Arms!?", evaluators enable dynamic game mechanics by automatically tracking character states, analyzing player actions, and enriching storytelling with reactive elements.

## Overview

Evaluators are classes that implement the `Evaluator` interface and are automatically triggered when chunks are emitted by agents. They can perform lightweight analysis (like counting words) or complex LLM-based evaluations (like sentiment analysis). Annotations are stored in the chunk's `annotations` object using fully qualified domain names (FQDNs) as keys to prevent conflicts.

## How It Works

1. **Registration**: Evaluators are registered with the `EvaluatorManager` singleton
2. **Triggering**: When an agent calls `addChunk()`, chunk events are emitted
3. **Execution**: All evaluators that support the chunk's type run in parallel
4. **Annotation**: Results are stored in `chunk.annotations[fqdn]`

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

Evaluators are automatically integrated when agents add chunks:

```typescript
// In an agent
this.addChunk({
    type: ChunkType.Text,
    content: "Hello world!",
    timestamp: Date.now()
});

// Evaluators run automatically, adding annotations like:
// chunk.annotations['evaluators.LengthEvaluator'] = { chars: 12, words: 2 }
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