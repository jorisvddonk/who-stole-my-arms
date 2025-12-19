import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { PromptManager, PromptProvider, NamedGroup, PromptTemplate } from '../../lib/prompt-manager';
import { MockStorage } from '../mocks/MockStorage';

// Mock prompt provider
class MockPromptProvider implements PromptProvider {
    private groups: Record<string, NamedGroup> = {};

    constructor(groups: Record<string, NamedGroup> = {}) {
        this.groups = groups;
    }

    getNamedPromptGroup(groupName: string, context?: any): Promise<NamedGroup | null> {
        return Promise.resolve(this.groups[groupName] || null);
    }

    getAvailablePromptGroups(): { name: string; description: string }[] {
        return Object.keys(this.groups).map(name => ({
            name,
            description: `Description for ${name}`
        }));
    }
}

// Mock storage for testing
class TestStorage {
    private data: Map<string, any> = new Map();
    private componentVersions: Map<string, number> = new Map();
    private nextId = 1;

    getTableName(): string { return 'test_prompts'; }
    getDB(): any { return {}; }
    getSessionId(): string | undefined { return 'test-session'; }
    execute(sql: string, params?: any[]): any {
        if (sql.includes('INSERT OR REPLACE')) {
            const [name, dataStr] = params!;
            const id = this.nextId++;
            this.data.set(id.toString(), { id: id.toString(), name, data: dataStr });
        } else if (sql.includes('CREATE TABLE')) {
            // Table creation - do nothing
        }
    }
    query(sql: string, params?: any[]): any[] { return []; }

    async init(): Promise<void> {}
    async findAll(): Promise<any[]> {
        return Array.from(this.data.values());
    }
    async insert(data: any, id?: string): Promise<void> {
        const recordId = id || this.nextId++.toString();
        this.data.set(recordId, { id: recordId, ...data });
    }
    async update(id: string, data: any): Promise<void> {
        if (this.data.has(id)) {
            this.data.set(id, { id, ...data });
        }
    }
    async delete(id: string): Promise<void> {
        this.data.delete(id);
    }
    async findById(id: string): Promise<any> {
        return this.data.get(id) || null;
    }
    async getComponentVersion(): Promise<number | null> {
        return this.componentVersions.get('tools.prompt.manager') || null;
    }
    async setComponentVersion(version: number): Promise<void> {
        this.componentVersions.set('tools.prompt.manager', version);
    }
}

describe('PromptManager', () => {
    let promptManager: PromptManager;
    let mockStorage: TestStorage;

    beforeEach(() => {
        mockStorage = new TestStorage();
        promptManager = new PromptManager();
    });

    describe('constructor', () => {
        test('should initialize without toolbox collector', () => {
            expect(promptManager).toBeInstanceOf(PromptManager);
        });
    });

    describe('getFQDN', () => {
        test('should return correct FQDN', () => {
            expect(promptManager.getFQDN()).toBe('tools.prompt.manager');
        });
    });

    describe('init', () => {
        test('should initialize storage', async () => {
            await promptManager.init(mockStorage);

            // Should have created default template
            const templates = await promptManager.getAllTemplates(mockStorage);
            expect(templates.length).toBe(1);
            expect(templates[0].name).toBe('chatMessage');
        });
    });

    describe('provider management', () => {
        test('should register and track providers', () => {
            const provider = new MockPromptProvider();

            promptManager.registerProvider('test', provider);

            expect(promptManager.getRegisteredProviders()).toContain('test');
        });

        test('should unregister providers', () => {
            const provider = new MockPromptProvider();

            promptManager.registerProvider('test', provider);
            expect(promptManager.getRegisteredProviders()).toContain('test');

            promptManager.unregisterProvider('test');
            expect(promptManager.getRegisteredProviders()).not.toContain('test');
        });
    });

    describe('getAllGroups', () => {
        test('should return groups from all providers', () => {
            const provider1 = new MockPromptProvider({
                'group1': {
                    type: 'group',
                    name: 'group1',
                    items: []
                }
            });
            const provider2 = new MockPromptProvider({
                'group2': {
                    type: 'group',
                    name: 'group2',
                    items: []
                }
            });

            promptManager.registerProvider('provider1', provider1);
            promptManager.registerProvider('provider2', provider2);

            const allGroups = promptManager.getAllGroups();

            expect(allGroups.length).toBe(2);
            expect(allGroups.find(g => g.provider === 'provider1')).toBeDefined();
            expect(allGroups.find(g => g.provider === 'provider2')).toBeDefined();
        });

        test('should handle provider errors gracefully', () => {
            const failingProvider = {
                getAvailablePromptGroups: () => { throw new Error('Provider error'); }
            } as any;

            promptManager.registerProvider('failing', failingProvider);

            expect(() => promptManager.getAllGroups()).not.toThrow();
        });
    });

    describe('template management', () => {
        test('should save template', () => {
            const name = 'test-template';
            const groups = ['group1', 'group2'];

            const result = promptManager.saveTemplate(mockStorage, name, groups);

            expect(result).toBe(true);
        });

        test('should not save template with invalid parameters', () => {
            expect(promptManager.saveTemplate(mockStorage, '', [])).toBe(false);
            expect(promptManager.saveTemplate(mockStorage, 'name', null as any)).toBe(false);
            expect(promptManager.saveTemplate(mockStorage, 'name', 'not-array' as any)).toBe(false);
        });

        test('should load template', async () => {
            const name = 'test-template';
            const groups = ['group1', 'group2'];

            promptManager.saveTemplate(mockStorage, name, groups);
            const loaded = await promptManager.loadTemplate(mockStorage, name);

            expect(loaded).toEqual(groups);
        });

        test('should return null for non-existent template', async () => {
            const loaded = await promptManager.loadTemplate(mockStorage, 'non-existent');

            expect(loaded).toBeNull();
        });

        test('should get all templates', async () => {
            promptManager.saveTemplate(mockStorage, 'template1', ['group1']);
            promptManager.saveTemplate(mockStorage, 'template2', ['group2']);

            const templates = await promptManager.getAllTemplates(mockStorage);

            expect(templates.length).toBe(2);
            expect(templates.map(t => t.name)).toContain('template1');
            expect(templates.map(t => t.name)).toContain('template2');
        });

        test('should delete template', async () => {
            const name = 'test-template';
            promptManager.saveTemplate(mockStorage, name, ['group1']);

            const deleted = await promptManager.deleteTemplate(mockStorage, name);

            expect(deleted).toBe(true);
            expect(await promptManager.loadTemplate(mockStorage, name)).toBeNull();
        });

        test('should return false when deleting non-existent template', async () => {
            const deleted = await promptManager.deleteTemplate(mockStorage, 'non-existent');

            expect(deleted).toBe(false);
        });
    });

    describe('getPrompt', () => {
        test('should build prompt from groups', async () => {
            const provider = new MockPromptProvider({
                'system': {
                    type: 'group',
                    name: 'system',
                    items: [
                        { type: 'prompt', name: 'system-prompt', prompt: 'You are a helpful assistant.' }
                    ]
                },
                'chat': {
                    type: 'group',
                    name: 'chat',
                    items: [
                        { type: 'prompt', name: 'chat-prompt', prompt: 'Please respond to the user.' }
                    ]
                }
            });

            promptManager.registerProvider('test', provider);

            const prompt = await promptManager.getPrompt(['test/system', 'test/chat']);

            expect(prompt).toContain('You are a helpful assistant.');
            expect(prompt).toContain('Please respond to the user.');
        });

        test('should handle group references', async () => {
            const provider = new MockPromptProvider({
                'base': {
                    type: 'group',
                    name: 'base',
                    items: [
                        { type: 'prompt', name: 'base-prompt', prompt: 'Base prompt.' }
                    ]
                },
                'extended': {
                    type: 'group',
                    name: 'extended',
                    items: [
                        { type: 'groupRef', name: 'test/base' },
                        { type: 'prompt', name: 'ext-prompt', prompt: 'Extended prompt.' }
                    ]
                }
            });

            promptManager.registerProvider('test', provider);

            const prompt = await promptManager.getPrompt(['test/extended']);

            expect(prompt).toContain('Base prompt.');
            expect(prompt).toContain('Extended prompt.');
        });

        test('should expand globs', async () => {
            const provider = new MockPromptProvider({
                'system1': {
                    type: 'group',
                    name: 'system1',
                    items: [{ type: 'prompt', name: 'p1', prompt: 'System 1.' }]
                },
                'system2': {
                    type: 'group',
                    name: 'system2',
                    items: [{ type: 'prompt', name: 'p2', prompt: 'System 2.' }]
                }
            });

            promptManager.registerProvider('test', provider);

            const prompt = await promptManager.getPrompt(['test/system*']);

            expect(prompt).toContain('System 1.');
            expect(prompt).toContain('System 2.');
        });
    });

    describe('getPromptFromTemplate', () => {
        test('should get prompt from template', async () => {
            const templateName = 'test-template';
            const groups = ['test/group1'];

            promptManager.saveTemplate(mockStorage, templateName, groups);

            // Mock getPrompt to avoid complex setup
            const mockGetPrompt = mock(promptManager, 'getPrompt');
            mockGetPrompt.mockResolvedValue('Mock prompt from template');

            const prompt = await promptManager.getPromptFromTemplate(mockStorage, templateName);

            expect(mockGetPrompt).toHaveBeenCalledWith(groups);
            expect(prompt).toBe('Mock prompt from template');
        });

        test('should return empty string for non-existent template', async () => {
            const prompt = await promptManager.getPromptFromTemplate(mockStorage, 'non-existent');

            expect(prompt).toBe('');
        });
    });

    describe('getCurrentContext', () => {
        test('should return current context', () => {
            const context = promptManager.getCurrentContext();

            expect(context).toBeDefined();
            expect(typeof context).toBe('object');
        });
    });

    describe('routes', () => {
        test('should provide routes for toolbox tool', () => {
            const routes = promptManager.getRoutes();

            expect(routes).toBeDefined();
            expect(typeof routes).toBe('object');
            expect(routes['/sessions/:sessionid/prompts/build']).toBeDefined();
            expect(routes['/sessions/:sessionid/prompts/templates']).toBeDefined();
        });

        test('should handle prompt building route', async () => {
            const routes = promptManager.getRoutes();
            const buildRoute = routes['/sessions/:sessionid/prompts/build'];

            // Mock request
            const mockReq = {
                json: mock(async () => ({ groups: ['test/group'], context: {} }))
            };

            // Mock getPrompt
            const mockGetPrompt = mock(promptManager, 'getPrompt');
            mockGetPrompt.mockResolvedValue('Built prompt');

            const response = await buildRoute.POST(mockReq as any);

            expect(response.status).toBeUndefined(); // Success response
            expect(await response.json()).toEqual({ prompt: 'Built prompt' });
        });

        test('should handle template listing route', async () => {
            const routes = promptManager.getRoutes();
            const templatesRoute = routes['/sessions/:sessionid/prompts/templates'];

            const mockReq = {};

            // Mock getAllTemplates
            const mockGetAllTemplates = mock(promptManager, 'getAllTemplates');
            mockGetAllTemplates.mockResolvedValue([]);

            const response = await templatesRoute.GET(mockReq as any);

            expect(response.status).toBeUndefined();
            expect(await response.json()).toEqual({ templates: [] });
        });
    });
});