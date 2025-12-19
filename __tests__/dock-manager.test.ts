import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { DockManager } from '../lib/dock-manager';
import { setupTestEnv } from './test-setup';

setupTestEnv();

describe('DockManager', () => {
  let mockToolboxCollector: any;
  let mockStorage: any;

  beforeEach(() => {
    mockToolboxCollector = {
      register: mock(() => {})
    };

    mockStorage = {
      execute: mock(() => Promise.resolve()),
      findAll: mock(() => Promise.resolve([])),
      setComponentVersion: mock(() => Promise.resolve()),
      getComponentVersion: mock(() => Promise.resolve(null)),
      getTableName: mock(() => 'test_table')
    };
  });

  describe('constructor', () => {
    test('should register widget with toolbox collector', () => {
      new DockManager(mockToolboxCollector);

      expect(mockToolboxCollector.register).toHaveBeenCalledWith('/widgets/add-widget-row-widget.js');
    });
  });

  describe('getFQDN', () => {
    test('should return correct fqdn', () => {
      const dockManager = new DockManager(mockToolboxCollector);

      expect(dockManager.getFQDN()).toBe('dock.manager');
    });
  });

  describe('init', () => {
    test('should create table and set version when current version is null', async () => {
      const dockManager = new DockManager(mockToolboxCollector);

      await dockManager.init(mockStorage);

      expect(mockStorage.execute).toHaveBeenCalledWith(
        `CREATE TABLE IF NOT EXISTS ${mockStorage.getTableName()} (name TEXT NOT NULL UNIQUE, data TEXT NOT NULL)`
      );
      expect(mockStorage.getComponentVersion).toHaveBeenCalled();
      expect(mockStorage.setComponentVersion).toHaveBeenCalledWith(1);
    });

    test('should not set version when current version exists', async () => {
      mockStorage.getComponentVersion.mockReturnValue(Promise.resolve(2));
      const dockManager = new DockManager(mockToolboxCollector);

      await dockManager.init(mockStorage);

      expect(mockStorage.setComponentVersion).not.toHaveBeenCalled();
    });
  });

  describe('getRoutes', () => {
    test('should return routes object with dock config endpoint', () => {
      const dockManager = new DockManager(mockToolboxCollector);
      const routes = dockManager.getRoutes();

      expect(routes).toHaveProperty('/sessions/:sessionId/dock/config');
      expect(typeof routes['/sessions/:sessionId/dock/config']).toBe('function');
    });

    describe('GET /sessions/:sessionId/dock/config', () => {
      test('should return default config when no dock-config row exists', async () => {
        const dockManager = new DockManager(mockToolboxCollector);
        const routes = dockManager.getRoutes();
        const router = routes['/sessions/:sessionId/dock/config'];

        const mockReq = {
          method: 'GET',
          context: {
            get: mock(() => mockStorage)
          }
        };

        const response = await router(mockReq as any);
        const result = await response.json();

        expect(mockStorage.findAll).toHaveBeenCalled();
        expect(result.rows).toEqual([
          { id: 1, widgets: [{ type: 'empty-widget', span: 12 }] }
        ]);
      });

      test('should return saved config when dock-config row exists', async () => {
        const savedConfig = [{ id: 1, widgets: [{ type: 'test-widget', span: 6 }] }];
        mockStorage.findAll.mockReturnValue(Promise.resolve([
          { name: 'dock-config', data: JSON.stringify(savedConfig) }
        ]));

        const dockManager = new DockManager(mockToolboxCollector);
        const routes = dockManager.getRoutes();
        const router = routes['/sessions/:sessionId/dock/config'];

        const mockReq = {
          method: 'GET',
          context: {
            get: mock(() => mockStorage)
          }
        };

        const response = await router(mockReq as any);
        const result = await response.json();

        expect(result.rows).toEqual(savedConfig);
      });

      test('should handle storage errors', async () => {
        mockStorage.findAll.mockImplementation(() => Promise.reject(new Error('Storage error')));

        const dockManager = new DockManager(mockToolboxCollector);
        const routes = dockManager.getRoutes();
        const router = routes['/sessions/:sessionId/dock/config'];

        const mockReq = {
          method: 'GET',
          context: {
            get: mock(() => mockStorage)
          }
        };

        const response = await router(mockReq as any);
        const result = await response.json();

        expect(response.status).toBe(500);
        expect(result.error).toBe('Storage error');
      });
    });

    describe('POST /sessions/:sessionId/dock/config', () => {
      test('should save dock config', async () => {
        const configRows = [{ id: 1, widgets: [{ type: 'test-widget', span: 12 }] }];
        const dockManager = new DockManager(mockToolboxCollector);
        const routes = dockManager.getRoutes();
        const router = routes['/sessions/:sessionId/dock/config'];

        const mockReq = {
          method: 'POST',
          json: mock(() => Promise.resolve({ rows: configRows })),
          context: {
            get: mock(() => mockStorage)
          }
        };

        const response = await router(mockReq as any);
        const result = await response.json();

        expect(mockStorage.execute).toHaveBeenCalledWith(
          `INSERT OR REPLACE INTO ${mockStorage.getTableName()} (name, data) VALUES (?, ?)`,
          ['dock-config', JSON.stringify(configRows)]
        );
        expect(result.success).toBe(true);
      });

      test('should handle storage errors', async () => {
        mockStorage.execute.mockImplementation(() => Promise.reject(new Error('Storage error')));

        const dockManager = new DockManager(mockToolboxCollector);
        const routes = dockManager.getRoutes();
        const router = routes['/sessions/:sessionId/dock/config'];

        const mockReq = {
          method: 'POST',
          json: mock(() => Promise.resolve({ rows: [] })),
          context: {
            get: mock(() => mockStorage)
          }
        };

        const response = await router(mockReq as any);
        const result = await response.json();

        expect(response.status).toBe(500);
        expect(result.error).toBe('Storage error');
      });
    });
  });
});