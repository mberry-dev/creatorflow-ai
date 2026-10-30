# 🚀 CreatorFlow AI

CreatorFlow AI is a full-stack web app that helps content creators write video titles, descriptions, hashtags, and SEO keywords for YouTube, TikTok, and Instagram Reels.

## 🌐 Try the Live Demo

**https://creatorflow-ai-zeta.vercel.app**

1. Create an account with any email and password.
2. Pick a tool (Titles, Descriptions, Hashtags, or SEO), enter a video topic, and click **Generate Assets**.
3. Save results to your Vault, then view them in the Analytics tab or export them as CSV/JSON.

> **Note:** The first load can take 30–60 seconds while the free backend server wakes up.
> The live demo runs in **mock AI mode**, so it returns sample output and makes no paid AI calls.

---

## 🌟 Key Features

- **AI Generation Suite:** Titles, descriptions, hashtags, and SEO keywords that respect each platform's character limits.
- **Cloud Vault Storage:** Save and organize generated content with Firebase Firestore.
- **Data Export:** One-click export of saved items to CSV and JSON.
- **Analytics Dashboard:** An overview of what you've generated, by category.
- **User Preferences:** Save a default tone and platform.
- **Preset Templates:** Quick-start templates for common video types.

## 🛠️ Tech Stack

- **Frontend:** React, Tailwind CSS, Firebase Authentication and Firestore (hosted on Vercel)
- **Backend:** Node.js, Express, OpenAI API with a built-in mock mode (hosted on Render)
- **Testing:** Vitest + Supertest (backend), Jest + React Testing Library (frontend), and a custom AI eval suite

---

## 💻 Run It Locally

### 1. Prerequisites

- [Node.js](https://nodejs.org/) **20 or newer** (includes npm)
- [Git](https://git-scm.com/)
- A free [Firebase](https://console.firebase.google.com/) account (for sign-in and saving)

### 2. Get the code

```bash
git clone https://github.com/mberry-dev/creatorflow-ai.git
cd creatorflow-ai
```

### 3. Set up the backend

```bash
cd backend
npm install
cp .env.example .env
```

That's all the backend needs. With no OpenAI key, it runs in **mock mode** and returns sample output for free.

### 4. Set up Firebase

1. In the [Firebase console](https://console.firebase.google.com/), click **Add project** and create a project.
2. Go to **Build → Authentication → Get started**, then enable **Email/Password**.
3. Go to **Build → Firestore Database → Create database**.
4. Open the **Rules** tab, paste the rules below, and click **Publish**. They let each user read and write only their own data.

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
       match /saved_assets/{assetId} {
         allow read, update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
         allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
       }
     }
   }
   ```

5. Go to **Project settings** (gear icon) → **Your apps** → click the **Web** icon (`</>`) to register a web app. Keep the `firebaseConfig` values it shows; you'll need them next.

### 5. Set up the frontend

```bash
cd ../frontend
npm install
cp .env.example .env
```

Open `frontend/.env` and replace the placeholder values with the ones from your `firebaseConfig`:

| `.env` variable | `firebaseConfig` value |
|---|---|
| `REACT_APP_FIREBASE_API_KEY` | `apiKey` |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `REACT_APP_FIREBASE_PROJECT_ID` | `projectId` |
| `REACT_APP_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `REACT_APP_FIREBASE_APP_ID` | `appId` |

Leave `REACT_APP_API_URL=http://localhost:5000` as it is.

### 6. Start the app (two terminals)

**Terminal 1, the backend:**

```bash
cd backend
npm start
```

**Terminal 2, the frontend:**

```bash
cd frontend
npm start
```

Your browser should open **http://localhost:3000**. Create an account and start generating. The app shows the backend status as **Online** when the two are connected.

> **Windows:** Run these commands in Git Bash. In PowerShell or Command Prompt, use `copy .env.example .env` instead of `cp .env.example .env`.

> **Optional, real AI output:** add your own key to `OPENAI_API_KEY` in `backend/.env`, then restart the backend. API usage is billed to that key's account.

---

## 🧪 Testing

**111 automated tests** (48 backend, 63 frontend). None of them call OpenAI or Firebase, so they're free and give the same result every time.

```bash
# From the backend/ folder
npm test

# From the frontend/ folder
npm test -- --watchAll=false
```

See [TESTING.md](TESTING.md) for what each test covers.

## 📊 AI Evals

Unit tests check that the code works. Evals check that the **AI output is good**. The eval suite in [`backend/evals/`](backend/evals/README.md) sends 20 realistic and tricky inputs (non-English topics, prompt injection, very long input, empty input) through the real API and scores each response with pass/fail checks.

| Prompt version | Average score (3 runs) |
|---|---|
| v1 (original prompts) | 12.0/20 (60%) |
| v2 (improved prompts) | 16.7/20 (83%) |

The evals also found two bugs, which are now fixed: a topic made of only spaces was sent to the AI, and Instagram descriptions used the wrong character limit. See the [evals README](backend/evals/README.md) for the full results and how to run them.
