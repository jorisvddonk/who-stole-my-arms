import { Evaluator } from '../../lib/core/Evaluator';
import { MockEvaluator } from './MockEvaluator';

// Mock EvaluatorManager class
export class MockEvaluatorManager {
    private evaluators: (Evaluator | Evaluator[])[] = [];

    constructor() {
        this.evaluators = [
            new MockEvaluator(),
            [new MockEvaluator(), new MockEvaluator()]
        ];
    }

    init(streamingLLM: any): void {
        // Mock initialization
    }

    getEvaluators(): (Evaluator | Evaluator[])[] {
        return [...this.evaluators];
    }
}