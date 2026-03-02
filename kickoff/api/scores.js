// api/scores.js
// Vercel serverless function — fetches live football data for all four leagues.
//
// SETUP: Set the environment variable SPORTRADAR_API_KEY in your Vercel project.
// Get a free trial key at https://developer.sportradar.com
//
// Endpoint: GET /api/scores?league=epl|la_liga|serie_a|ligue_1
// Returns:  { games, standings }

const LEAGUE_MAP = {
  epl:     { sport: 'soccer', league: 'sr:tournament:17',   name: 'Premier League' },
  la_liga: { sport: 'soccer', league: 'sr:tournament:8',    name: 'La Liga'        },
  serie_a: { sport: 'soccer', league: 'sr:tournament:23',   name: 'Serie A'        },
  ligue_1: { sport: 'soccer', league: 'sr:tournament:34',   name: 'Ligue 1'        },
};

// SportRadar Soccer API v4 base
const BASE = 'https://api.sportradar.com/soccer/trial/v4/en';

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SportRadar ${res.status}: ${await res.text()}`);
  return res.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.status(200).end();
    return;
  }

  const apiKey = process.env.SPORTRADAR_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'SPORTRADAR_API_KEY not set. Add it in Vercel → Settings → Environment Variables.' });
  }

  const league = req.query.league || 'epl';
  const meta   = LEAGUE_MAP[league];
  if (!meta) {
    return res.status(400).json({ error: `Unknown league "${league}". Use: epl, la_liga, serie_a, ligue_1` });
  }

  try {
    // We need: (1) recent schedule/results, (2) standings
    // SportRadar Soccer v4 endpoints:
    //   /tournaments/{tournament_id}/schedule.json          → full season schedule
    //   /tournaments/{tournament_id}/standings.json         → current standings
    //   /tournaments/{tournament_id}/live_timeline.json     → live scores (if applicable)

    const tournId = meta.league.replace('sr:tournament:', '');

    const [scheduleData, standingsData] = await Promise.all([
      fetchJSON(`${BASE}/tournaments/${meta.league}/schedule.json?api_key=${apiKey}`),
      fetchJSON(`${BASE}/tournaments/${meta.league}/standings.json?api_key=${apiKey}`),
    ]);

    // ── Parse schedule → recent results + upcoming fixtures ──────────────
    const now = Date.now();
    const ONE_WEEK_MS  = 7  * 24 * 60 * 60 * 1000;
    const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

    const allGames = (scheduleData.sport_events || []).map(e => {
      const sr = (scheduleData.sport_event_statuses || []).find(s => s.sport_event_id === e.id) || {};
      const home = e.competitors?.find(c => c.qualifier === 'home');
      const away = e.competitors?.find(c => c.qualifier === 'away');
      const startMs = new Date(e.scheduled).getTime();

      return {
        id:         e.id,
        status:     sr.status || (startMs > now ? 'scheduled' : 'unknown'),
        start_time: e.scheduled,
        home:       home?.abbreviation || '',
        away:       away?.abbreviation || '',
        home_name:  home?.name || '',
        away_name:  away?.name || '',
        home_score: sr.home_score ?? null,
        away_score: sr.away_score ?? null,
        win_probability: sr.win_probabilities ? {
          home: sr.win_probabilities.home,
          draw: sr.win_probabilities.draw,
          away: sr.win_probabilities.away,
        } : null,
      };
    });

    // Recent results (last 7 days) and upcoming fixtures (next 14 days)
    const results  = allGames.filter(g => ['closed','ended','complete'].includes(g.status) && now - new Date(g.start_time).getTime() < ONE_WEEK_MS);
    const live     = allGames.filter(g => ['live','inprogress','in_progress'].includes(g.status));
    const fixtures = allGames.filter(g => g.status === 'scheduled' && new Date(g.start_time).getTime() - now < TWO_WEEKS_MS && new Date(g.start_time).getTime() > now);

    // ── Parse standings ───────────────────────────────────────────────────
    const groups = standingsData.standings?.[0]?.groups || [];
    const table  = [];
    for (const group of groups) {
      for (const entry of (group.standings || [])) {
        table.push({
          rank:   entry.rank,
          name:   entry.team?.name || '',
          abbr:   entry.team?.abbreviation || '',
          played: entry.played,
          wins:   entry.win,
          draws:  entry.draw,
          losses: entry.loss,
          gf:     entry.goals_scored,
          ga:     entry.goals_against,
          gd:     (entry.goals_scored || 0) - (entry.goals_against || 0),
          points: entry.points,
        });
      }
    }
    table.sort((a, b) => a.rank - b.rank);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    res.status(200).json({
      league,
      name: meta.name,
      games: [...live, ...results],
      fixtures,
      table,
      fetched_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[kickoff/scores]', err);
    res.status(502).json({ error: err.message });
  }
}
