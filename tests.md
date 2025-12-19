# Testing Guide

This guide explains how to write and run tests for the "Who Stole My Arms!?" project using Bun's built-in test runner.

## Overview

"Who Stole My Arms!?" is an AI-powered RPG system built with Bun and TypeScript. The project uses Bun's native testing framework with TypeScript support to ensure code quality and reliability.

Tests are located in the `__tests__/` directory and follow a modular structure.

```
__tests__/
├── agents/
│   └── agent-manager.test.ts  # AgentManager class tests
├── arena/
│   └── arena.test.ts          # Arena class tests
├── core/
│   ├── evaluator.test.ts     # Evaluator base class tests
│   ├── llm-agent.test.ts     # LLMAgent base class tests
│   └── tool.test.ts          # Tool base class tests
├── evaluators/
│   └── evaluator-manager.test.ts # EvaluatorManager class tests
├── managers/
│   ├── arena-manager.test.ts # ArenaManager class tests
│   ├── database-manager.test.ts # DatabaseManager class tests
│   └── prompt-manager.test.ts # PromptManager class tests
└── mocks/
    ├── MockAgent.ts           # Mock agent implementation
    ├── MockAgentManager.ts    # Mock agent manager
    ├── MockEvaluator.ts       # Mock evaluator implementation
    ├── MockEvaluatorManager.ts # Mock evaluator manager
    ├── MockStreamingLLM.ts    # Mock streaming LLM
    └── helpers.ts             # Test helper functions
```

The project maintains comprehensive test coverage across core architecture and manager classes.

## Running Tests

### Basic Test Execution

```bash
# Run all tests
bun test

# Run tests in watch mode (re-runs on file changes)
bun test --watch

# Run specific test file
bun test __tests__/arena/arena.test.ts

# Run tests matching a pattern
bun test -t "should wire agent events"
```

### Test Output

Tests will show:
- Number of tests passed/failed
- Execution time
- Detailed error messages for failures
- Code coverage (if configured)

## Writing Tests

### Test Structure

Tests use Bun's test API:

```typescript
import { describe, test, expect, beforeEach, mock } from 'bun:test';

describe('Component Name', () => {
    let setupVar: any;

    beforeEach(() => {
        // Setup code that runs before each test
        setupVar = new Component();
    });

    test('should do something', () => {
        // Test implementation
        expect(setupVar.method()).toBe('expected result');
    });
});
```

### Test Organization

1. **Describe blocks** group related tests
2. **beforeEach/afterEach** set up and tear down test state
3. **test()** defines individual test cases
4. **Mocking** isolates units under test

### Assertions

Use Bun's expect API:

```typescript
// Basic assertions
expect(result).toBe(expected);
expect(result).toEqual(expectedObject);
expect(result).toContain(substring);
expect(result).toBeInstanceOf(Class);

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();

// Numbers
expect(number).toBeGreaterThan(0);
expect(number).toBeLessThanOrEqual(10);

// Arrays/Collections
expect(array).toHaveLength(5);
expect(array).toContain(item);
expect(object).toHaveProperty('key', 'value');

// Errors
expect(() => riskyFunction()).toThrow();
expect(() => riskyFunction()).toThrow('specific error message');
```

## Mock System

The project includes a comprehensive mock system for testing:

### Available Mocks

#### Core Mocks
- **MockStreamingLLM**: Simulates LLM streaming responses
- **MockAgent**: Basic agent implementation for testing
- **MockEvaluator**: Evaluator implementation for testing

#### Manager Mocks
- **MockAgentManager**: Provides mock agents to Arena
- **MockEvaluatorManager**: Provides mock evaluators to Arena

#### Helper Functions
- **createMockTask()**: Creates test task objects
- **createMockChunk()**: Creates test chunk objects

### Using Mocks

```typescript
import { describe, test, expect, beforeEach } from 'bun:test';
import { Arena } from '../../lib/core/Arena';
import { MockStreamingLLM } from '../mocks/MockStreamingLLM';
import { MockAgentManager } from '../mocks/MockAgentManager';
import { MockEvaluatorManager } from '../mocks/MockEvaluatorManager';

describe('Arena', () => {
    let arena: Arena;

    beforeEach(() => {
        const streamingLLM = new MockStreamingLLM();
        const agentManager = new MockAgentManager();
        const evaluatorManager = new MockEvaluatorManager();

        arena = new Arena(streamingLLM, agentManager, evaluatorManager);
    });

    test('should initialize correctly', () => {
        expect(arena.streamingLLM).toBeInstanceOf(MockStreamingLLM);
        expect(Object.keys(arena.agents)).toHaveLength(2); // MockAgent + ErrorAgent
    });
});
```

### Customizing Mocks

You can extend or modify mocks for specific test scenarios:

```typescript
class CustomMockAgent extends MockAgent {
    async run(task: Task): Promise<string> {
        // Custom behavior for this test
        return 'Custom response';
    }
}
```

## Testing Patterns

### Unit Testing

Test individual components in isolation:

```typescript
test('Arena.generateId should create unique IDs', () => {
    const id1 = Arena.generateId();
    const id2 = Arena.generateId();

    expect(typeof id1).toBe('string');
    expect(id1).not.toBe(id2);
    expect(id1.length).toBeGreaterThan(0);
});
```

### Integration Testing

Test component interactions:

```typescript
test('Arena should wire agent events correctly', () => {
    const agent = arena.agents['MockAgent'];
    let eventReceived = false;

    arena.eventEmitter.on('chunk', () => {
        eventReceived = true;
    });

    // Trigger agent event
    agent.eventEmitter.emit('chunk', createMockChunk());

    expect(eventReceived).toBe(true);
});
```

### Error Testing

Test error conditions and recovery:

```typescript
test('should handle agent execution errors', async () => {
    const agent = arena.agents['MockAgent'];

    // Mock agent to throw error
    const originalRun = agent.run;
    agent.run = () => Promise.reject(new Error('Test error'));

    const result = await arena.run_agent(createMockTask());

    expect(result).toEqual({
        content: expect.stringContaining('error')
    });

    // Restore original
    agent.run = originalRun;
});
```

## Best Practices

### Test Naming

Use descriptive names that explain what the test verifies:

```typescript
// ✅ Good
test('should increment error count when agent fails')

// ❌ Bad
test('error handling')
test('test 1')
```

### Setup/Teardown

Use `beforeEach` for common setup:

```typescript
describe('Arena event wiring', () => {
    let arena: Arena;
    let testArena: Arena;

    beforeEach(() => {
        arena = new Arena(new MockStreamingLLM(), new MockAgentManager(), new MockEvaluatorManager());
        testArena = new Arena(new MockStreamingLLM(), new MockAgentManager(), new MockEvaluatorManager());
    });

    test('should wire agent events', () => {
        // Use testArena for isolated testing
    });
});
```

### Mock Management

Always restore mocked methods after tests:

```typescript
test('should mock method behavior', () => {
    const original = component.method;
    component.method = mock(() => 'mocked');

    // Test with mock
    expect(component.method()).toBe('mocked');

    // Restore
    component.method = original;
});
```

### Test Isolation

Each test should be independent:

```typescript
// ✅ Good - each test creates fresh instances
describe('Component', () => {
    test('test 1', () => {
        const component = new Component();
        // ...
    });

    test('test 2', () => {
        const component = new Component();
        // ...
    });
});

// ❌ Bad - shared state between tests
describe('Component', () => {
    let component: Component;

    beforeEach(() => {
        component = new Component();
    });

    test('test 1', () => {
        component.modifyState();
    });

    test('test 2', () => {
        // component state was modified by previous test!
    });
});
```

### Async Testing

Use async/await for asynchronous tests:

```typescript
test('should handle async operations', async () => {
    const result = await arena.run_agent(task);
    expect(result).toBe('expected');
});
```

## Debugging Tests

### Running Failed Tests

```bash
# Run only failed tests
bun test --reporter=verbose

# Debug specific test
bun test -t "failing test name"
```

### Common Issues

1. **Mock not working**: Ensure you're mocking the correct method and instance
2. **Async test timeouts**: Use proper async/await patterns
3. **Import errors**: Check relative paths and file extensions
4. **Type errors**: Ensure proper TypeScript types in tests

### Debugging Tips

Add console logging in tests:

```typescript
test('debug test', () => {
    console.log('Test state:', component.state);
    expect(component.state).toBe('expected');
});
```

Use Bun's test utilities:

```typescript
test.only('run only this test', () => {
    // This test runs exclusively
});

test.skip('skip this test', () => {
    // This test is skipped
});
```

## Adding New Tests

When adding tests for new components:

1. **Identify what to test**: Focus on public APIs and critical paths for each component
2. **Choose test location**: Create `__tests__/component/` directories (e.g., `__tests__/agents/`, `__tests__/tools/`)
3. **Create mocks**: Extend existing mocks or create new ones as needed for component dependencies
4. **Write tests**: Follow the patterns established in the Arena tests
5. **Run and verify**: Ensure tests pass and provide good coverage

### Current and Planned Test Coverage

✅ **Core Classes** (`__tests__/core/`): Base classes for evaluators, agents, and tools
✅ **Arena System** (`__tests__/arena/`, `__tests__/managers/arena-manager.test.ts`): Central orchestration and arena management
✅ **Manager Classes** (`__tests__/agents/`, `__tests__/evaluators/`, `__tests__/managers/`): Agent, evaluator, database, and prompt managers
✅ **Database Layer** (`__tests__/managers/database-manager.test.ts`): Storage and persistence functionality

As the project expands, tests should be added for:

- **Agent Classes** (`__tests__/agents/`): Individual agent implementations (TopLevelAgent, ConversationalAgent, etc.)
- **Tool System** (`__tests__/tools/`): Various tool implementations and toolbox integration
- **Widget System** (`__tests__/widgets/`): Frontend widget components and dock management
- **API Integration** (`__tests__/api/`): LLM API clients and external service integrations
- **End-to-End** (`__tests__/e2e/`): Full system integration tests

## Coverage

Bun provides built-in test coverage support. You can generate coverage reports to see which parts of your code are tested.

### Running Coverage

```bash
# Generate coverage report
bun test --coverage

# Generate coverage report in a specific directory
bun test --coverage --coverage-reporter=html --coverage-dir=./coverage

# Generate coverage report with different formats
bun test --coverage --coverage-reporter=text
bun test --coverage --coverage-reporter=json
bun test --coverage --coverage-reporter=lcov
```

### Coverage Output

Coverage reports show:
- **Line coverage**: Percentage of executable lines covered by tests
- **Function coverage**: Percentage of functions called by tests
- **Branch coverage**: Percentage of code branches executed
- **Statement coverage**: Percentage of statements executed

### Coverage Formats

- **text**: Console output (default)
- **html**: Interactive HTML report in `coverage/` directory
- **json**: Machine-readable JSON format
- **lcov**: LCOV format for CI/CD integration

### Example Coverage Report

```
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |    85.2 |    78.9  |   92.1  |   84.7 |
 lib/core/         |    95.1 |    89.2  |   98.3  |   94.8 |
  Arena.ts         |    96.2 |    91.4  |   98.7  |   95.9 | 142,156
  LLMAgent.ts      |    94.8 |    87.6  |   97.9  |   94.2 | 234,267
  Tool.ts          |    95.5 |    89.9  |   98.8  |   95.1 |
 lib/agents/       |    82.3 |    75.4  |   88.9  |   81.7 |
  AgentManager.ts  |    84.1 |    77.2  |   91.2  |   83.4 | 45-52,67-71
-------------------|---------|----------|---------|---------|-------------------
```

### Interpreting Coverage

- **High coverage (80%+)**: Good test coverage, most code paths tested
- **Medium coverage (50-80%)**: Adequate coverage, some edge cases may be missed
- **Low coverage (<50%)**: Insufficient testing, high risk of bugs

### Coverage Goals

Target coverage levels for different component types:

- **Critical components**: 90%+ line coverage (core classes, managers)
- **Complex logic**: 80%+ branch coverage (business logic, algorithms)
- **Public APIs**: 95%+ function coverage (interfaces, exports)
- **Overall project**: 75%+ line coverage (sustainable target)

### Coverage Best Practices

1. **Focus on critical paths**: Test error handling, edge cases, and complex logic
2. **Avoid testing trivial code**: Don't test simple getters/setters for coverage alone
3. **Use coverage to guide testing**: Identify untested code and add tests accordingly
4. **Don't aim for 100%**: Some code (error logging, debug statements) may not need testing
5. **Review coverage reports regularly**: Ensure new code maintains or improves coverage

### Coverage Insights

Use coverage reports to guide testing priorities:

- **Focus on high-impact areas**: Core classes, managers, and critical paths
- **Identify gaps**: Look for untested error paths and edge cases
- **Balance coverage types**: Line coverage shows breadth, branch coverage shows depth
- **Track trends**: Monitor coverage over time to ensure quality doesn't regress

Coverage reports are tools for continuous improvement, not fixed targets.

### Troubleshooting Coverage

- **Coverage not generated**: Ensure you're using `bun test --coverage`
- **Missing source maps**: Coverage works best with TypeScript source maps
- **External dependencies**: Only your code is included, not node_modules
- **Dynamic imports**: May not be tracked if not executed during tests

## Troubleshooting

### Common Error Messages

- **"Cannot find module"**: Check import paths and file extensions
- **"Mock function not called"**: Verify you're mocking the correct instance/method
- **"Test timeout"**: Async operations need proper await handling
- **"Type errors"**: Ensure proper TypeScript types in test files

### Getting Help

- Check existing test patterns (starting with Arena tests)
- Review Bun test documentation
- Look at TypeScript testing patterns
- Reference the Arena test implementation as a template
- Ask team members for guidance on testing specific components