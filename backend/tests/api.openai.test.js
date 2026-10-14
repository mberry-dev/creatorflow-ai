// Integration tests: Express API in Production (Live AI) mode with the OpenAI client mocked.
// Verifies prompt construction, response parsing, and graceful fallback when OpenAI fails.
// No real OpenAI calls are made.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { loadApp } from './helpers.js';

const { mockCreate, OpenAIMock } = vi.hoisted(() => {
  const mockCreate = vi.fn();
  const OpenAIMock = vi.fn(function () {
    return { chat: { completions: { create: mockCreate } } };
  });
  return { mockCreate, OpenAIMock };
});

vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));
vi.mock('openai', () => ({ default: OpenAIMock }));

const reply = (content) => ({ choices: [{ message: { content } }] });
const systemPrompt = () => mockCreate.mock.calls[0][0].messages[0].content;
const userPrompt = () => mockCreate.mock.calls[0][0].messages[1].content;

let app;
let openAIConstructorCalls; // captured at startup, before any per-test mock reset

beforeAll(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  app = await loadApp({ apiKey: 'sk-test-key' });
  openAIConstructorCalls = [...OpenAIMock.mock.calls];
});

beforeEach(() => {
  mockCreate.mockReset();
});

describe('Startup mode selection', () => {
  it('creates the OpenAI client with the key from the environment', () => {
    expect(openAIConstructorCalls).toEqual([[{ apiKey: 'sk-test-key' }]]);
  });

  it('reports Production (Live AI) mode on /api/status', async () => {
    const res = await request(app).get('/api/status');
    expect(res.body.message).toContain('Production (Live AI)');
  });

  it('reports live mode on /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body).toEqual({ status: 'OK', mode: 'live', version: '1.0.0' });
  });

  it('treats the .env.example placeholder key as "no key" and stays in Mock Mode', async () => {
    const mockApp = await loadApp({ apiKey: 'your_real_openai_key_here' });
    const res = await request(mockApp).get('/api/status');
    expect(res.body.message).toContain('Development (Mock AI)');
  });
});

describe('POST /api/generate/title (live)', () => {
  it('returns the titles parsed from the OpenAI JSON response', async () => {
    mockCreate.mockResolvedValue(reply(JSON.stringify({ titles: ['A', 'B', 'C', 'D'] })));
    const res = await request(app).post('/api/generate/title').send({ topic: 'podcasting' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, suggestions: ['A', 'B', 'C', 'D'] });
  });

  it('requests gpt-4o-mini in JSON mode and sends the topic as the user message', async () => {
    mockCreate.mockResolvedValue(reply('{"titles":[]}'));
    await request(app).post('/api/generate/title').send({ topic: 'podcasting' });
    const args = mockCreate.mock.calls[0][0];
    expect(args.model).toBe('gpt-4o-mini');
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect(userPrompt()).toBe('Topic: podcasting');
  });

  it('enforces a 100-character limit for YouTube titles', async () => {
    mockCreate.mockResolvedValue(reply('{"titles":[]}'));
    await request(app).post('/api/generate/title').send({ topic: 't', platform: 'YouTube' });
    expect(systemPrompt()).toContain('under 100 characters');
  });

  it('enforces a 150-character limit for non-YouTube titles', async () => {
    mockCreate.mockResolvedValue(reply('{"titles":[]}'));
    await request(app).post('/api/generate/title').send({ topic: 't', platform: 'TikTok' });
    expect(systemPrompt()).toContain('under 150 characters');
  });

  it('includes the platform and tone in the system prompt', async () => {
    mockCreate.mockResolvedValue(reply('{"titles":[]}'));
    await request(app).post('/api/generate/title').send({ topic: 't', platform: 'Instagram', tone: 'Professional' });
    expect(systemPrompt()).toContain('Instagram video');
    expect(systemPrompt()).toContain('Professional tone');
  });

  it('returns an empty array when OpenAI omits the "titles" key', async () => {
    mockCreate.mockResolvedValue(reply('{"other":1}'));
    const res = await request(app).post('/api/generate/title').send({ topic: 't' });
    expect(res.body.suggestions).toEqual([]);
  });

  it('falls back to mock titles when the OpenAI call fails', async () => {
    mockCreate.mockRejectedValue(new Error('429 rate limit'));
    const res = await request(app).post('/api/generate/title').send({ topic: 'fallback topic' });
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toHaveLength(3);
    expect(res.body.suggestions[0]).toContain('fallback topic');
  });

  it('falls back to mock titles when OpenAI returns invalid JSON', async () => {
    mockCreate.mockResolvedValue(reply('not json'));
    const res = await request(app).post('/api/generate/title').send({ topic: 'bad json' });
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toHaveLength(3);
  });
});

describe('POST /api/generate/description (live)', () => {
  it('returns the description text from OpenAI', async () => {
    mockCreate.mockResolvedValue(reply('A great description.'));
    const res = await request(app).post('/api/generate/description').send({ topic: 't' });
    expect(res.body).toEqual({ success: true, description: 'A great description.' });
  });

  it.each([
    ['TikTok', 2200],
    ['Instagram Reels', 2200],
    ['YouTube', 5000],
  ])('uses the correct character limit for %s (%i)', async (platform, limit) => {
    mockCreate.mockResolvedValue(reply('ok'));
    await request(app).post('/api/generate/description').send({ topic: 't', platform });
    expect(systemPrompt()).toContain(`under ${limit} characters`);
  });

  it('falls back to the mock description when the OpenAI call fails', async () => {
    mockCreate.mockRejectedValue(new Error('network down'));
    const res = await request(app).post('/api/generate/description').send({ topic: 'fallback' });
    expect(res.status).toBe(200);
    expect(res.body.description).toContain('"fallback"');
  });
});

describe('POST /api/generate/hashtags (live)', () => {
  it('splits the space-separated OpenAI response into an array', async () => {
    mockCreate.mockResolvedValue(reply('  #one #two\n#three  '));
    const res = await request(app).post('/api/generate/hashtags').send({ topic: 't' });
    expect(res.body.hashtags).toEqual(['#one', '#two', '#three']);
  });

  it('asks OpenAI for hashtags for the selected platform', async () => {
    mockCreate.mockResolvedValue(reply('#a'));
    await request(app).post('/api/generate/hashtags').send({ topic: 't', platform: 'TikTok' });
    expect(systemPrompt()).toContain('for TikTok');
  });

  it('falls back to mock hashtags when the OpenAI call fails', async () => {
    mockCreate.mockRejectedValue(new Error('500'));
    const res = await request(app).post('/api/generate/hashtags').send({ topic: 'dogs' });
    expect(res.body.hashtags).toContain('#dogs');
  });
});

describe('POST /api/generate/seo (live)', () => {
  it('returns keywords and recommendations parsed from OpenAI JSON', async () => {
    mockCreate.mockResolvedValue(reply(JSON.stringify({ keywords: ['k1'], recommendations: ['r1', 'r2'] })));
    const res = await request(app).post('/api/generate/seo').send({ topic: 't' });
    expect(res.body).toEqual({ success: true, keywords: ['k1'], recommendations: ['r1', 'r2'] });
  });

  it('returns empty arrays when OpenAI omits keywords/recommendations', async () => {
    mockCreate.mockResolvedValue(reply('{}'));
    const res = await request(app).post('/api/generate/seo').send({ topic: 't' });
    expect(res.body.keywords).toEqual([]);
    expect(res.body.recommendations).toEqual([]);
  });

  it('falls back to mock SEO data when the OpenAI call fails', async () => {
    mockCreate.mockRejectedValue(new Error('timeout'));
    const res = await request(app).post('/api/generate/seo').send({ topic: 'Chess' });
    expect(res.body.keywords).toContain('chess');
    expect(res.body.recommendations).toHaveLength(3);
  });
});
