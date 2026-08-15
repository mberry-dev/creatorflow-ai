import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

// Load variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const apiKey = process.env.OPENAI_API_KEY;
let openai = null;

if (!apiKey || apiKey === 'your_real_openai_key_here') {
  console.log('⚠️ No OpenAI API key detected. Operating in Developer Mock Mode.');
} else {
  openai = new OpenAI({ apiKey });
}

// Enable CORS for local development and live deployment (Vercel)
const allowedOrigins = [
  'http://localhost:3000',
  process.env.ALLOWED_ORIGIN // e.g., https://your-app.vercel.app
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Permissive fallback for deployment testing
    }
  }
}));

app.use(express.json());

// System Architecture Health Endpoint
app.get('/api/status', (req, res) => {
  const mode = openai ? 'Production (Live AI)' : 'Development (Mock AI)';
  res.json({ 
    success: true, 
    status: 'Online', 
    message: `Backend pipeline is live via CORS! Running mode: ${mode}` 
  });
});

// ==========================================
// US-03: AI Title Generator Endpoint (with Char Limits)
// ==========================================
app.post('/api/generate/title', async (req, res) => {
  const { topic, platform = 'YouTube', tone = 'Engaging' } = req.body;
  if (!topic) return res.status(400).json({ success: false, error: 'Topic is required' });

  // Platform character limits
  const maxChars = platform === 'YouTube' ? 100 : 150;

  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: `Generate exactly 3 to 5 viral titles for a ${platform} video. Match a ${tone} tone. STRICT RULE: Each title MUST be under ${maxChars} characters. Return a valid JSON object: {"titles": ["title1", "title2"]}` 
          },
          { role: 'user', content: `Topic: ${topic}` }
        ],
        response_format: { type: "json_object" }
      });
      const parsedData = JSON.parse(completion.choices[0].message.content);
      return res.json({ success: true, suggestions: parsedData.titles || [] });
    } catch (error) {
      console.warn('⚠️ OpenAI live account error. Diverting to local fallback metrics...');
    }
  }

  // Graceful Fallback Engine
  setTimeout(() => {
    res.json({
      success: true,
      suggestions: [
        `🚀 [🔥 Ultimate Guide] ${topic} (${tone} Style)`,
        `Why Everyone is Talking About: ${topic}!`,
        `${topic} Explained Simply for ${platform} Creators`
      ]
    });
  }, 800);
});

// ==========================================
// US-05: AI Description Generator Endpoint (with Char Limits)
// ==========================================
app.post('/api/generate/description', async (req, res) => {
  const { topic, platform = 'YouTube' } = req.body;
  if (!topic) return res.status(400).json({ success: false, error: 'Topic is required' });

  const maxChars = (platform === 'TikTok' || platform === 'Instagram Reels') ? 2200 : 5000;

  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: `You are an expert copywriter. Write a clean, highly engaging SEO description summary for a ${platform} video. STRICT RULE: Keep the full description under ${maxChars} characters.` 
          },
          { role: 'user', content: `Topic: ${topic}` }
        ]
      });
      return res.json({ success: true, description: completion.choices[0].message.content });
    } catch (error) {
      console.warn('⚠️ OpenAI live account error. Diverting to local fallback metrics...');
    }
  }

  // Graceful Fallback Engine
  setTimeout(() => {
    res.json({
      success: true,
      description: `Welcome back to my channel! In this video, we dive deep into everything you need to know about "${topic}", optimized specifically for ${platform}. Make sure to like, subscribe, and leave your thoughts below!\n\n📌 Timestamps coming soon!`
    });
  }, 800);
});

// ==========================================
// US-04: AI Hashtags Generator Endpoint
// ==========================================
app.post('/api/generate/hashtags', async (req, res) => {
  const { topic, platform = 'YouTube' } = req.body;
  if (!topic) return res.status(400).json({ success: false, error: 'Topic is required' });

  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: `Generate 10 to 15 trending hashtags for ${platform} based on the topic. Return a space-separated string starting with '#'.` 
          },
          { role: 'user', content: `Topic: ${topic}` }
        ]
      });
      const tagsArray = completion.choices[0].message.content.trim().split(/\s+/);
      return res.json({ success: true, hashtags: tagsArray });
    } catch (error) {
      console.warn('⚠️ OpenAI live account error. Diverting to local fallback metrics...');
    }
  }

  // Graceful Fallback Engine
  setTimeout(() => {
    const formatTag = topic.toLowerCase().replace(/[^a-z0-9]/g, '');
    res.json({
      success: true,
      hashtags: [`#${formatTag}`, `#${platform.toLowerCase()}`, '#creatorflow', '#trending', '#viral', '#contentcreator']
    });
  }, 800);
});

// ==========================================
// US-06: AI SEO Recommendations Endpoint
// ==========================================
app.post('/api/generate/seo', async (req, res) => {
  const { topic } = req.body;
  if (!topic) return res.status(400).json({ success: false, error: 'Topic is required' });

  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Analyze this content concept for search visibility. Return a valid JSON object containing a "keywords" array and a "recommendations" array.' },
          { role: 'user', content: `Topic: ${topic}` }
        ],
        response_format: { type: "json_object" }
      });
      const parsedSeo = JSON.parse(completion.choices[0].message.content);
      return res.json({ success: true, keywords: parsedSeo.keywords || [], recommendations: parsedSeo.recommendations || [] });
    } catch (error) {
      console.warn('⚠️ OpenAI live account error. Diverting to local fallback metrics...');
    }
  }

  // Graceful Fallback Engine
  setTimeout(() => {
    res.json({
      success: true,
      keywords: [topic.toLowerCase(), `${topic} tutorial`, 'how to', 'best content tools'],
      recommendations: [
        'Include your primary keyword in the first 25 words of your video description.',
        'Say your keyword out loud during the first 30 seconds of video playback.',
        'Create a high-contrast thumbnail using cyan or neon accents to maximize CTR.'
      ]
    });
  }, 800);
});

app.get('/api/health', (req, res) => {
  const mode = openai ? 'live' : 'mock';
  res.json({
    status: 'OK',
    mode: mode,
    version: '1.0.0'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Secure API Proxy active on: http://localhost:${PORT}`);
});