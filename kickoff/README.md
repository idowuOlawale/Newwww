# ⚽ Kickoff — Live Football Scores

Live Premier League, La Liga, Serie A & Ligue 1 scores, fixtures, and standings.  
Powered by SportRadar. Deployed on Vercel.

---

## 🚀 Deploy in 5 minutes

### 1. Get a free SportRadar API key
1. Sign up at [developer.sportradar.com](https://developer.sportradar.com)
2. Create a new app and subscribe to **Soccer Trial** (free, 1,000 req/day)
3. Copy your API key

### 2. Deploy to Vercel

**Option A — Vercel CLI (recommended)**
```bash
npm install -g vercel       # install CLI once
cd kickoff                  # enter this folder
vercel                      # follow prompts, deploy!
```

**Option B — GitHub**
1. Push this folder to a GitHub repo
2. Go to [vercel.com/new](https://vercel.com/new) → Import repo
3. Click **Deploy**

### 3. Add your API key
1. In Vercel dashboard → Your project → **Settings → Environment Variables**
2. Add:
   - **Name:** `SPORTRADAR_API_KEY`
   - **Value:** your key from step 1
3. Click **Redeploy** (or `vercel --prod` from CLI)

That's it! Your site is live and auto-updating. ✅

---

## 🔄 How it stays up to date

- The frontend fetches `/api/scores?league=epl` (etc.) on every page load
- It auto-refreshes silently every **60 seconds**
- The Vercel serverless function caches responses for **60 seconds** (via `Cache-Control`)
- SportRadar pushes live scores and table updates in real time

---

## 📁 Project structure

```
kickoff/
├── api/
│   └── scores.js          # Vercel serverless function (fetches SportRadar)
├── public/
│   └── index.html         # Frontend SPA
├── vercel.json            # Routing config
├── package.json
└── README.md
```

---

## 🛠 Local development

```bash
npm install
vercel dev     # runs locally at http://localhost:3000
```

Requires `SPORTRADAR_API_KEY` set in a `.env.local` file:
```
SPORTRADAR_API_KEY=your_key_here
```

---

## 📡 API endpoint

`GET /api/scores?league={league}`

| league | Competition |
|--------|-------------|
| `epl` | Premier League |
| `la_liga` | La Liga |
| `serie_a` | Serie A |
| `ligue_1` | Ligue 1 |

**Response:**
```json
{
  "league": "epl",
  "name": "Premier League",
  "games": [...],       // recent results + live games
  "fixtures": [...],    // upcoming matches with win probability
  "table": [...],       // full standings
  "fetched_at": "2026-03-01T20:00:00.000Z"
}
```
