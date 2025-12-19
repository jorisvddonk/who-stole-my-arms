import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { ChatterboxVoiceEngine } from '../lib/chatterbox-voice-engine';
import { voiceEmitter } from '../lib/voice-emitter';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { setupTestEnv } from './test-setup';

setupTestEnv();

describe('ChatterboxVoiceEngine', () => {
  let mockFetch: any;
  let mockEmit: any;

  beforeEach(() => {
    mockFetch = mock(() => Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio data']))
    }));
    global.fetch = mockFetch;

    mockEmit = mock(() => undefined);
    voiceEmitter.emit = mockEmit;
  });

  afterEach(() => {
    mock.restore();
  });

  describe('constructor', () => {
    test('should create instance with defaults when file not found', () => {
      let backup: string | null = null;
      if (existsSync('./voice-settings.json')) {
        backup = readFileSync('./voice-settings.json', 'utf-8');
        unlinkSync('./voice-settings.json');
      }
      const engine = new ChatterboxVoiceEngine();
      expect(engine).toBeInstanceOf(ChatterboxVoiceEngine);
      if (backup) {
        writeFileSync('./voice-settings.json', backup);
      }
    });

    test('should load settings from file when exists', async () => {
      const customSettings = {
        voices: { text: 'Custom.wav' },
        generation: { temperature: 0.9 }
      };
      let backup: string | null = null;
      if (existsSync('./voice-settings.json')) {
        backup = readFileSync('./voice-settings.json', 'utf-8');
      }
      writeFileSync('./voice-settings.json', JSON.stringify(customSettings));
      const engine = new ChatterboxVoiceEngine();
      engine.onText('test');
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/tts', expect.objectContaining({
        body: JSON.stringify({
          text: 'test',
          voice_mode: 'clone',
          reference_audio_filename: 'Custom.wav',
          output_format: 'wav',
          temperature: 0.9
        })
      }));
      if (backup) {
        writeFileSync('./voice-settings.json', backup);
      } else {
        unlinkSync('./voice-settings.json');
      }
    });
  });

  describe('voice handling', () => {
    beforeEach(() => {
      mock.module('fs', () => ({
        readFileSync: mock(() => { throw new Error('ENOENT'); })
      }));
    });

    test('should queue and process text voice', async () => {
      const engine = new ChatterboxVoiceEngine();
      engine.onText('hello world');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/tts', expect.any(Object));
      expect(mockEmit).toHaveBeenCalledWith('voice', expect.objectContaining({
        audioDataUrl: expect.stringContaining('data:audio/wav;base64,'),
        text: 'hello world'
      }));
    });

    test('should queue and process quote voice', async () => {
      const engine = new ChatterboxVoiceEngine();
      engine.onQuote('quoted text');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/tts', expect.any(Object));
      expect(mockEmit).toHaveBeenCalledWith('voice', expect.objectContaining({
        audioDataUrl: expect.stringContaining('data:audio/wav;base64,'),
        text: 'quoted text'
      }));
    });

    test('should skip bold if no voice file', () => {
      const engine = new ChatterboxVoiceEngine();
      engine.onBold('bold text');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('should skip emphasis if no voice file', () => {
      const engine = new ChatterboxVoiceEngine();
      engine.onEmphasis('emphasis text');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('should skip code if no voice file', () => {
      const engine = new ChatterboxVoiceEngine();
      engine.onCode('code text');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('should skip tool_call', () => {
      const engine = new ChatterboxVoiceEngine();
      engine.onToolCall({});
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('should skip tool_result', () => {
      const engine = new ChatterboxVoiceEngine();
      engine.onToolResult({});
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('should skip reasoning if no voice file', () => {
      const engine = new ChatterboxVoiceEngine();
      engine.onReasoning('reasoning text');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      mock.module('fs', () => ({
        readFileSync: mock(() => { throw new Error('ENOENT'); })
      }));
    });

    test('should handle fetch error gracefully', async () => {
      const engine = new ChatterboxVoiceEngine();
      mockFetch.mockImplementation(() => Promise.resolve({ ok: false, statusText: 'error' }));

      engine.onText('test');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockEmit).not.toHaveBeenCalled();
    });

    test('should handle fetch failure gracefully', async () => {
      const engine = new ChatterboxVoiceEngine();
      mockFetch.mockImplementation(() => Promise.resolve({ ok: false, statusText: 'error' }));

      engine.onText('test');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockEmit).not.toHaveBeenCalled();
    });
  });

  describe('queue processing', () => {
    beforeEach(() => {
      mock.module('fs', () => ({
        readFileSync: mock(() => { throw new Error('ENOENT'); })
      }));
    });

    test('should process multiple voices sequentially', async () => {
      const engine = new ChatterboxVoiceEngine();
      engine.onText('first');
      engine.onText('second');

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockEmit).toHaveBeenCalledTimes(2);
    });
  });
});