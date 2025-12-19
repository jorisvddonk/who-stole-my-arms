import { describe, test, expect } from 'bun:test';
import { ToolboxCollector } from '../lib/toolbox-collector';
import { setupTestEnv } from './test-setup';

setupTestEnv();

describe('ToolboxCollector', () => {
  describe('constructor', () => {
    test('should create instance with empty tools array', () => {
      const collector = new ToolboxCollector();
      expect(collector.getTools()).toEqual([]);
    });
  });

  describe('register', () => {
    test('should add url to tools array', () => {
      const collector = new ToolboxCollector();
      collector.register('/widgets/test-widget.js');
      expect(collector.getTools()).toEqual(['/widgets/test-widget.js']);
    });

    test('should add multiple urls', () => {
      const collector = new ToolboxCollector();
      collector.register('/widgets/widget1.js');
      collector.register('/widgets/widget2.js');
      expect(collector.getTools()).toEqual(['/widgets/widget1.js', '/widgets/widget2.js']);
    });
  });

  describe('getTools', () => {
    test('should return copy of tools array', () => {
      const collector = new ToolboxCollector();
      collector.register('/widgets/test.js');
      const tools = collector.getTools();
      expect(tools).toEqual(['/widgets/test.js']);

      // Verify it's a copy - modifying the returned array shouldn't affect internal state
      tools.push('/widgets/another.js');
      expect(collector.getTools()).toEqual(['/widgets/test.js']);
    });

    test('should return empty array when no tools registered', () => {
      const collector = new ToolboxCollector();
      expect(collector.getTools()).toEqual([]);
    });
  });
});