import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { KoboldAPI } from '../../lib/llm-api/KoboldAPI';
import { setupTestEnv } from '../test-setup';

setupTestEnv();

describe('KoboldAPI', () => {
  let api: KoboldAPI;
  const mockBaseUrl = 'http://localhost:5001';

  beforeEach(() => {
    // Reset fetch mock before each test
    mock.restore();
    api = new KoboldAPI(mockBaseUrl);
  });

  describe('constructor', () => {
    test('should initialize with default settings', () => {
      expect(api).toBeDefined();
      // Access private properties for testing
      expect((api as any).baseUrl).toBe(mockBaseUrl);
      expect((api as any).settings.baseUrl).toBe(mockBaseUrl);
      expect((api as any).settings.n).toBe(1);
      expect((api as any).settings.maxLength).toBe(500);
      expect((api as any).settings.temperature).toBe(0.75);
    });

    test('should initialize with custom settings', () => {
      const customSettings = {
        temperature: 0.5,
        maxLength: 100,
        topP: 0.8
      };

      const customApi = new KoboldAPI(mockBaseUrl, customSettings);

      expect((customApi as any).settings.temperature).toBe(0.5);
      expect((customApi as any).settings.maxLength).toBe(100);
      expect((customApi as any).settings.topP).toBe(0.8);
      // Other settings should remain default
      expect((customApi as any).settings.n).toBe(1);
    });

    test('should generate unique genkey', () => {
      const api1 = new KoboldAPI(mockBaseUrl);
      const api2 = new KoboldAPI(mockBaseUrl);

      expect((api1 as any).genkey).not.toBe((api2 as any).genkey);
      expect((api1 as any).genkey).toMatch(/^KCPP[A-Z0-9]{4}$/);
    });
  });

  describe('updateSettings', () => {
    test('should update settings and baseUrl', () => {
      const newSettings = {
        baseUrl: 'http://new-url:5001',
        temperature: 0.9,
        maxLength: 200
      };

      api.updateSettings(newSettings);

      expect((api as any).baseUrl).toBe('http://new-url:5001');
      expect((api as any).settings.temperature).toBe(0.9);
      expect((api as any).settings.maxLength).toBe(200);
    });
  });

  describe('generate', () => {
    test('should call API and return generated text', async () => {
      const mockResponse = {
        results: [{ text: 'Generated response' }]
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        } as Response)
      );

      const result = await api.generate('Test prompt');

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/v1/generate`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"prompt":"Test prompt"')
        })
      );
      expect(result).toBe('Generated response');
    });

    test('should handle empty results', async () => {
      const mockResponse = { results: [] };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        } as Response)
      );

      const result = await api.generate('Test prompt');

      expect(result).toBe('');
    });

    test('should throw error on API failure', async () => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 500
        } as Response)
      );

      await expect(api.generate('Test prompt')).rejects.toThrow('Koboldcpp error: 500');
    });
  });

  describe('generateStream', () => {
    test('should yield tokens from streaming response', async () => {
      const mockResponse = {
        body: {
          getReader: () => ({
            read: mock()
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"token": "Hello"}\n\n') })
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"token": " world"}\n\n') })
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"finish_reason": "stop"}\n\n') })
              .mockResolvedValue({ done: true }),
            releaseLock: mock()
          })
        },
        ok: true
      };

      global.fetch = mock(() => Promise.resolve(mockResponse as any));

      const tokens: Array<{ token?: string; finishReason?: string }> = [];
      for await (const chunk of api.generateStream('Test prompt')) {
        tokens.push(chunk);
      }

      expect(tokens).toEqual([
        { token: 'Hello' },
        { token: ' world' },
        { finishReason: 'stop' }
      ]);
    });

    test('should throw error on API failure', async () => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 404
        } as Response)
      );

      let error: Error | null = null;
      try {
        for await (const _ of api.generateStream('Test prompt')) {
          // Should not reach here
        }
      } catch (e) {
        error = e as Error;
      }

      expect(error).not.toBeNull();
      expect(error!.message).toBe('Koboldcpp error: 404');
    });

    test('should handle malformed JSON gracefully', async () => {
      const mockResponse = {
        body: {
          getReader: () => ({
            read: mock()
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: invalid json\n\n') })
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"token": "valid"}\n\n') })
              .mockResolvedValue({ done: true }),
            releaseLock: mock()
          })
        },
        ok: true
      };

      global.fetch = mock(() => Promise.resolve(mockResponse as any));

      const tokens: Array<{ token?: string; finishReason?: string }> = [];
      for await (const chunk of api.generateStream('Test prompt')) {
        tokens.push(chunk);
      }

      expect(tokens).toEqual([{ token: 'valid' }]);
    });
  });

  describe('getVersion', () => {
    test('should call version endpoint and return data', async () => {
      const mockData = { version: '1.2.3' };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData)
        } as Response)
      );

      const result = await api.getVersion();

      expect(global.fetch).toHaveBeenCalledWith(`${mockBaseUrl}/api/extra/version`);
      expect(result).toEqual(mockData);
    });
  });

  describe('getModel', () => {
    test('should call model endpoint and return model name', async () => {
      const mockData = { result: 'llama-7b' };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData)
        } as Response)
      );

      const result = await api.getModel();

      expect(global.fetch).toHaveBeenCalledWith(`${mockBaseUrl}/api/v1/model`);
      expect(result).toBe('llama-7b');
    });
  });

  describe('getPerformanceStats', () => {
    test('should call performance endpoint', async () => {
      const mockData = { perf: 'stats' };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData)
        } as Response)
      );

      const result = await api.getPerformanceStats();

      expect(global.fetch).toHaveBeenCalledWith(`${mockBaseUrl}/api/extra/perf`);
      expect(result).toEqual(mockData);
    });
  });

  describe('getMaxContextLength', () => {
    test('should call max context length endpoint', async () => {
      const mockData = { value: 4096 };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData)
        } as Response)
      );

      const result = await api.getMaxContextLength();

      expect(global.fetch).toHaveBeenCalledWith(`${mockBaseUrl}/api/extra/true_max_context_length`);
      expect(result).toBe(4096);
    });
  });

  describe('countTokens', () => {
    test('should call tokencount endpoint and return token info', async () => {
      const mockData = { value: 42, ids: [1, 2, 3] };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData)
        } as Response)
      );

      const result = await api.countTokens('Hello world');

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/extra/tokencount`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ prompt: 'Hello world' })
        })
      );
      expect(result).toEqual({ count: 42, tokens: [1, 2, 3] });
    });
  });

  describe('tokenize', () => {
    test('should call tokenize endpoint', async () => {
      const mockData = { ids: [101, 205, 305] };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData)
        } as Response)
      );

      const result = await api.tokenize('Test text');

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/extra/tokenize`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ prompt: 'Test text' })
        })
      );
      expect(result).toEqual([101, 205, 305]);
    });
  });

  describe('detokenize', () => {
    test('should call detokenize endpoint', async () => {
      const mockData = { result: 'Hello world' };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData)
        } as Response)
      );

      const result = await api.detokenize([101, 205, 305]);

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/extra/detokenize`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ ids: [101, 205, 305] })
        })
      );
      expect(result).toBe('Hello world');
    });
  });

  describe('abortGeneration', () => {
    test('should call abort endpoint and return true on success', async () => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({})
        } as Response)
      );

      const result = await api.abortGeneration();

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/extra/abort`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ genkey: (api as any).genkey })
        })
      );
      expect(result).toBe(true);
    });

    test('should return false on API failure', async () => {
      global.fetch = mock(() => Promise.reject(new Error('Network error')));

      const result = await api.abortGeneration();

      expect(result).toBe(false);
    });
  });

  describe('checkGeneration', () => {
    test('should call check endpoint and return text on success', async () => {
      const mockData = { results: [{ text: 'Generated text' }] };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData)
        } as Response)
      );

      const result = await api.checkGeneration();

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/extra/generate/check`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ genkey: (api as any).genkey })
        })
      );
      expect(result).toBe('Generated text');
    });

    test('should return null on API failure', async () => {
      global.fetch = mock(() => Promise.reject(new Error('Network error')));

      const result = await api.checkGeneration();

      expect(result).toBe(null);
    });
  });
});