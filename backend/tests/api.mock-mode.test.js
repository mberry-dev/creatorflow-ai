// Integration tests: Express API running in Developer Mock Mode (no OpenAI key).
// Requests go through the real Express app via Supertest.

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { loadApp } from './helpers.js';

vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));
vi.mock('openai', () => ({ default: vi.fn() }));

let app;

beforeAll(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  app = await loadApp({ apiKey: undefined, allowedOrigin: 'https://creatorflow-ai.vercel.app' });
});

describe('GET /api/status', () => {
  it('returns 200 with Online status', async () => {
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('Online');
  });

  it('reports Development (Mock AI) mode when no API key is set', async () => {
    const res = await request(app).get('/api/status');
    expect(res.body.message).toContain('Development (Mock AI)');
  });
});

describe('GET /api/health', () => {
  it('returns status OK, mock mode, and the API version', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'OK', mode: 'mock', version: '1.0.0' });
  });
});

describe('Input validation (all generate endpoints)', () => {
  const endpoints = ['title', 'description', 'hashtags', 'seo'];

  it.each(endpoints)('POST /api/generate/%s returns 400 when topic is missing', async (ep) => {
    const res = await request(app).post(`/api/generate/${ep}`).send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'Topic is required' });
  });

  it.each(endpoints)('POST /api/generate/%s returns 400 when topic is an empty string', async (ep) => {
    const res = await request(app).post(`/api/generate/${ep}`).send({ topic: '' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/generate/title')
      .set('Content-Type', 'application/json')
      .send('{"topic": ');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/generate/title (mock fallback)', () => {
  it('returns 3 suggestions that include the topic', async () => {
    const res = await request(app).post('/api/generate/title').send({ topic: 'Podcast Tips', platform: 'TikTok', tone: 'Professional' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.suggestions).toHaveLength(3);
    res.body.suggestions.forEach((s) => expect(s).toContain('Podcast Tips'));
  });

  it('uses the requested tone and platform in the suggestions', async () => {
    const res = await request(app).post('/api/generate/title').send({ topic: 'Guitar', platform: 'TikTok', tone: 'Professional' });
    expect(res.body.suggestions.join(' ')).toContain('Professional Style');
    expect(res.body.suggestions.join(' ')).toContain('TikTok Creators');
  });

  it('defaults to YouTube platform and Engaging tone', async () => {
    const res = await request(app).post('/api/generate/title').send({ topic: 'Guitar' });
    expect(res.body.suggestions.join(' ')).toContain('Engaging Style');
    expect(res.body.suggestions.join(' ')).toContain('YouTube Creators');
  });
});

describe('POST /api/generate/description (mock fallback)', () => {
  it('returns a description containing the topic and platform', async () => {
    const res = await request(app).post('/api/generate/description').send({ topic: 'morning workout', platform: 'Instagram' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.description).toContain('"morning workout"');
    expect(res.body.description).toContain('Instagram');
  });

  it('defaults to YouTube when no platform is given', async () => {
    const res = await request(app).post('/api/generate/description').send({ topic: 'x' });
    expect(res.body.description).toContain('YouTube');
  });
});

describe('POST /api/generate/hashtags (mock fallback)', () => {
  it('returns hashtags that all start with #', async () => {
    const res = await request(app).post('/api/generate/hashtags').send({ topic: 'travel vlog', platform: 'TikTok' });
    expect(res.status).toBe(200);
    expect(res.body.hashtags.length).toBeGreaterThan(0);
    res.body.hashtags.forEach((tag) => expect(tag.startsWith('#')).toBe(true));
  });

  it('builds a topic tag that is lowercase with spaces and symbols stripped', async () => {
    const res = await request(app).post('/api/generate/hashtags').send({ topic: 'Travel Vlog: Tokyo!', platform: 'TikTok' });
    expect(res.body.hashtags[0]).toBe('#travelvlogtokyo');
    expect(res.body.hashtags).toContain('#tiktok');
  });

  it('defaults the platform tag to #youtube', async () => {
    const res = await request(app).post('/api/generate/hashtags').send({ topic: 'cats' });
    expect(res.body.hashtags).toContain('#youtube');
  });
});

describe('POST /api/generate/seo (mock fallback)', () => {
  it('returns keywords (including the lowercased topic) and 3 recommendations', async () => {
    const res = await request(app).post('/api/generate/seo').send({ topic: 'Beginner Guitar' });
    expect(res.status).toBe(200);
    expect(res.body.keywords).toContain('beginner guitar');
    expect(res.body.keywords).toContain('Beginner Guitar tutorial');
    expect(res.body.recommendations).toHaveLength(3);
  });
});

describe('Routing and CORS', () => {
  it('returns 404 for an unknown route', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('returns CORS headers for the localhost dev origin', async () => {
    const res = await request(app).get('/api/status').set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('returns CORS headers for the ALLOWED_ORIGIN production origin', async () => {
    const res = await request(app).get('/api/status').set('Origin', 'https://creatorflow-ai.vercel.app');
    expect(res.headers['access-control-allow-origin']).toBe('https://creatorflow-ai.vercel.app');
  });

  it('answers CORS preflight (OPTIONS) requests for generate endpoints', async () => {
    const res = await request(app)
      .options('/api/generate/title')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });
});
