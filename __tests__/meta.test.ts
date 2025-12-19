import { describe, test, expect } from 'bun:test';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

function findTestFiles(dir: string): string[] {
    const files: string[] = [];
    const items = readdirSync(dir);
    for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        if (stat.isDirectory() && item !== 'node_modules') {
            files.push(...findTestFiles(fullPath));
        } else if (stat.isFile() && item.endsWith('.test.ts')) {
            files.push(fullPath);
        }
    }
    return files;
}

describe('Meta Test Setup', () => {
    test('all test files should call setupTestEnv()', () => {
        const testFiles = findTestFiles('__tests__');
        expect(testFiles.length).toBeGreaterThanOrEqual(10); // Ensure we found at least 10 test files
        const missingSetup = [];
        for (const file of testFiles) {
            if (file.includes('meta.test.ts')) continue; // Skip this meta test file
            const content = readFileSync(file, 'utf-8');
            if (!content.includes('setupTestEnv();')) {
                missingSetup.push(file);
            }
        }
        if (missingSetup.length > 0) {
            throw new Error(`Test files missing setupTestEnv(): ${missingSetup.join(', ')}`);
        }
    });
});