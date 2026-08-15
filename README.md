# 🚀 CreatorFlow AI

CreatorFlow AI is a full-stack web application designed for content creators to generate platform-optimized video titles, descriptions, hashtags, and SEO recommendations for YouTube, TikTok, and Instagram Reels.

---

## 🌟 Key Features
- **AI Generation Suite:** Automated generation of titles, descriptions, hashtags, and SEO keywords tailored to specific platform character constraints.
- **Cloud Vault Storage:** Firebase Firestore persistence to save, filter, and organize generated content assets.
- **Data Export:** 1-click export of saved vault assets to CSV and JSON formats.
- **Analytics Dashboard:** Graphical overview of content generation metrics and platform distributions.
- **User Preferences:** Save custom default tones, target platforms, and branding preferences.
- **Preset Templates:** Quick-start templates to jumpstart content generation.

---

## 🛠️ Tech Stack
- **Frontend:** React, Tailwind CSS, Lucide Icons, Firebase Authentication & Firestore
- **Backend:** Node.js, Express, OpenAI API, CORS, Dotenv

---

## 🚀 Local Development Setup

### 1. Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Fill in your OPENAI_API_KEY inside .env
npm start


### 3. Frontend Setup
cd frontend
npm install
cp .env.example .env
# Fill in your Firebase config keys inside .env
npm start
