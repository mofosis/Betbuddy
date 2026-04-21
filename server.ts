import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { Pool, PoolClient } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthUser {
  uid: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request { user: AuthUser; }
  }
}

// ─── PostgreSQL Pool ─────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => console.error('Unexpected DB error:', err));

// ─── SSE ─────────────────────────────────────────────────────────────────────

const sseClients = new Map<string, Set<Response>>();

function sendSSE(userId: string, event: string, data: unknown) {
  const clients = sseClients.get(userId);
  if (!clients) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) { try { c.write(payload); } catch { /**/ } }
}

function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [, clients] of sseClients)
    for (const c of clients) { try { c.write(payload); } catch { /**/ } }
}

// ─── Express App ─────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Auth middleware — reads headers set by Authelia via Caddy forward_auth.
// In dev mode without Authelia, DEV_USER_* env vars are used as fallback.
app.use((req: Request, _res: Response, next: NextFunction) => {
  const uid   = ((req.headers['remote-user']   as string) || process.env.DEV_USER_ID    || 'dev').toLowerCase();
  const name  =  (req.headers['remote-name']   as string) || process.env.DEV_USER_NAME  || 'Dev User';
  const email =  (req.headers['remote-email']  as string) || process.env.DEV_USER_EMAIL || '';
  const groups = (req.headers['remote-groups'] as string) || process.env.DEV_USER_GROUPS || '';
  req.user = { uid, name, email, isAdmin: groups.includes('admins') };
  next();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureUser(user: AuthUser) {
  await pool.query(
    `INSERT INTO users (uid, display_name, display_name_lower)
     VALUES ($1, $2, $3)
     ON CONFLICT (uid) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           display_name_lower = EXCLUDED.display_name_lower`,
    [user.uid, user.name, user.name.toLowerCase()]
  );
}

function formatBet(row: any) {
  return {
    id: row.id,
    creatorId: row.creator_id,
    creatorName: row.creator_name,
    title: row.title,
    description: row.description,
    status: row.status,
    outcomes: row.outcomes,
    totalPot: row.total_pot,
    amount: row.total_pot,
    winnerOutcomeIndex: row.winner_outcome_index,
    invitedUserIds: row.invited_user_ids || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    participants: Object.fromEntries(
      (row.parts || []).map((p: any) => [p.uid, p])
    ),
  };
}

async function getBetById(id: string) {
  const r = await pool.query(
    `SELECT b.*,
       COALESCE(json_agg(
         json_build_object(
           'uid', bp.user_id, 'name', bp.user_name,
           'outcomeIndex', bp.outcome_index, 'stake', bp.stake
         )
       ) FILTER (WHERE bp.user_id IS NOT NULL), '[]') AS parts
     FROM bets b
     LEFT JOIN bet_participants bp ON b.id = bp.bet_id
     WHERE b.id = $1
     GROUP BY b.id`,
    [id]
  );
  return r.rows[0] ? formatBet(r.rows[0]) : null;
}

async function insertNotification(
  client: PoolClient, userId: string, type: string,
  title: string, message: string, betId?: string
) {
  await client.query(
    `INSERT INTO notifications (user_id, type, title, message, bet_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, title, message, betId ?? null]
  );
  sendSSE(userId, 'notification', {});
}

// ─── /api/me ─────────────────────────────────────────────────────────────────

app.get('/api/me', async (req, res) => {
  try {
    await ensureUser(req.user);
    const r = await pool.query('SELECT * FROM users WHERE uid = $1', [req.user.uid]);
    const u = r.rows[0];
    res.json(mapUser(u, req.user.isAdmin));
  } catch (e) { console.error(e); res.status(500).json({ error: 'DB error' }); }
});

app.post('/api/profile', async (req, res) => {
  const { theme, displayName, photoURL } = req.body;
  const sets: string[] = []; const vals: unknown[] = []; let i = 1;
  if (theme !== undefined)     { sets.push(`theme=$${i++}`);         vals.push(theme); }
  if (displayName)             { sets.push(`display_name=$${i++}`,
                                            `display_name_lower=$${i++}`);
                                 vals.push(displayName, displayName.toLowerCase()); }
  if (photoURL !== undefined)  { sets.push(`photo_url=$${i++}`);     vals.push(photoURL || null); }
  if (sets.length) {
    vals.push(req.user.uid);
    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE uid=$${i}`, vals);
  }
  const r = await pool.query('SELECT * FROM users WHERE uid=$1', [req.user.uid]);
  res.json(mapUser(r.rows[0], req.user.isAdmin));
});

function mapUser(u: any, isAdmin = false) {
  return {
    uid: u.uid,
    displayName: u.display_name,
    displayNameLower: u.display_name_lower,
    email: u.email || '',
    photoURL: u.photo_url,
    balance: u.balance,
    wins: u.wins,
    losses: u.losses,
    theme: u.theme,
    isAdmin,
    lastBetResolvedAt: u.last_bet_resolved_at,
    lastChallengeDeductionAt: u.last_challenge_deduction_at,
  };
}

// ─── /api/users ───────────────────────────────────────────────────────────────

app.get('/api/users', async (req, res) => {
  const { search } = req.query;
  let q = `SELECT uid, display_name, display_name_lower, photo_url, balance,
                   wins, losses, theme, last_bet_resolved_at, last_challenge_deduction_at
           FROM users`;
  const vals: unknown[] = [];
  if (search) { q += ' WHERE display_name_lower LIKE $1'; vals.push(`${String(search).toLowerCase()}%`); }
  q += ' ORDER BY wins DESC, balance DESC LIMIT 100';
  const r = await pool.query(q, vals);
  res.json(r.rows.map(u => mapUser(u)));
});

// ─── /api/bets ────────────────────────────────────────────────────────────────

app.get('/api/bets', async (_req, res) => {
  const r = await pool.query(
    `SELECT b.*,
       COALESCE(json_agg(
         json_build_object(
           'uid', bp.user_id, 'name', bp.user_name,
           'outcomeIndex', bp.outcome_index, 'stake', bp.stake
         )
       ) FILTER (WHERE bp.user_id IS NOT NULL), '[]') AS parts
     FROM bets b
     LEFT JOIN bet_participants bp ON b.id = bp.bet_id
     GROUP BY b.id
     ORDER BY b.created_at DESC
     LIMIT 200`
  );
  res.json(r.rows.map(formatBet));
});

app.post('/api/bets', async (req, res) => {
  const { title, description, outcomes, stake, outcomeIndex, invitedUserIds } = req.body;
  if (!title || !outcomes?.length || !Number.isFinite(stake) || stake <= 0)
    return res.status(400).json({ error: 'Invalid bet data' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ur = await client.query('SELECT balance FROM users WHERE uid=$1 FOR UPDATE', [req.user.uid]);
    if (!ur.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }
    if (ur.rows[0].balance < stake) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient balance' }); }

    const br = await client.query(
      `INSERT INTO bets (creator_id, creator_name, title, description, outcomes, total_pot, invited_user_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [req.user.uid, req.user.name, title, description || null, outcomes, stake, invitedUserIds || []]
    );
    const betId = br.rows[0].id;

    await client.query(
      `INSERT INTO bet_participants (bet_id, user_id, user_name, outcome_index, stake)
       VALUES ($1,$2,$3,$4,$5)`,
      [betId, req.user.uid, req.user.name, outcomeIndex ?? 0, stake]
    );
    await client.query('UPDATE users SET balance=balance-$1 WHERE uid=$2', [stake, req.user.uid]);
    await client.query(
      `INSERT INTO activities (user_id, user_name, type, bet_id, bet_title, amount)
       VALUES ($1,$2,'bet_created',$3,$4,$5)`,
      [req.user.uid, req.user.name, betId, title, stake]
    );
    await client.query('COMMIT');

    const bet = await getBetById(betId);
    broadcast('bets_updated', { action: 'created', bet });
    const balR = await pool.query('SELECT balance FROM users WHERE uid=$1', [req.user.uid]);
    sendSSE(req.user.uid, 'balance_updated', { balance: balR.rows[0].balance });
    broadcast('activities_updated', {});
    res.json(bet);
  } catch (e) {
    await client.query('ROLLBACK'); console.error(e);
    res.status(500).json({ error: 'DB error' });
  } finally { client.release(); }
});

app.post('/api/bets/:id/join', async (req, res) => {
  const { id } = req.params;
  const { outcomeIndex, stake } = req.body;
  if (!Number.isFinite(stake) || stake <= 0) return res.status(400).json({ error: 'Invalid stake' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const [ur, br] = await Promise.all([
      client.query('SELECT balance FROM users WHERE uid=$1 FOR UPDATE', [req.user.uid]),
      client.query('SELECT * FROM bets WHERE id=$1 FOR UPDATE', [id]),
    ]);
    if (!ur.rows[0] || !br.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    if (ur.rows[0].balance < stake) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient balance' }); }

    await client.query(
      `INSERT INTO bet_participants (bet_id, user_id, user_name, outcome_index, stake)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (bet_id, user_id) DO UPDATE SET outcome_index=$4, stake=$5`,
      [id, req.user.uid, req.user.name, outcomeIndex ?? 0, stake]
    );
    await client.query(
      `UPDATE bets SET total_pot=total_pot+$1, status='active', updated_at=NOW(),
       invited_user_ids=array_remove(invited_user_ids,$2) WHERE id=$3`,
      [stake, req.user.uid, id]
    );
    await client.query('UPDATE users SET balance=balance-$1 WHERE uid=$2', [stake, req.user.uid]);
    await client.query(
      `INSERT INTO activities (user_id, user_name, type, bet_id, bet_title, amount, outcome_name)
       VALUES ($1,$2,'bet_joined',$3,$4,$5,$6)`,
      [req.user.uid, req.user.name, id, br.rows[0].title, stake, br.rows[0].outcomes[outcomeIndex ?? 0]]
    );
    await insertNotification(client, br.rows[0].creator_id, 'update',
      'Wette beigetreten', `${req.user.name} ist deiner Wette "${br.rows[0].title}" beigetreten!`, id);
    await client.query('COMMIT');

    const bet = await getBetById(id);
    broadcast('bets_updated', { action: 'updated', bet });
    const balR = await pool.query('SELECT balance FROM users WHERE uid=$1', [req.user.uid]);
    sendSSE(req.user.uid, 'balance_updated', { balance: balR.rows[0].balance });
    broadcast('activities_updated', {});
    res.json(bet);
  } catch (e) {
    await client.query('ROLLBACK'); console.error(e);
    res.status(500).json({ error: 'DB error' });
  } finally { client.release(); }
});

app.post('/api/bets/:id/leave', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pr = await client.query(
      'SELECT stake FROM bet_participants WHERE bet_id=$1 AND user_id=$2 FOR UPDATE', [id, req.user.uid]);
    if (!pr.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not a participant' }); }
    const stake = pr.rows[0].stake;
    await client.query('DELETE FROM bet_participants WHERE bet_id=$1 AND user_id=$2', [id, req.user.uid]);
    const br = await client.query(
      `UPDATE bets SET total_pot=total_pot-$1, updated_at=NOW() WHERE id=$2 RETURNING creator_id, title`, [stake, id]);
    await client.query('UPDATE users SET balance=balance+$1 WHERE uid=$2', [stake, req.user.uid]);
    await insertNotification(client, br.rows[0].creator_id, 'update',
      'Teilnehmer ausgestiegen', `${req.user.name} ist aus "${br.rows[0].title}" ausgestiegen.`, id);
    await client.query('COMMIT');

    const bet = await getBetById(id);
    broadcast('bets_updated', { action: 'updated', bet });
    const balR = await pool.query('SELECT balance FROM users WHERE uid=$1', [req.user.uid]);
    sendSSE(req.user.uid, 'balance_updated', { balance: balR.rows[0].balance });
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK'); console.error(e);
    res.status(500).json({ error: 'DB error' });
  } finally { client.release(); }
});

app.post('/api/bets/:id/resolve', async (req, res) => {
  const { id } = req.params;
  const { winnerOutcomeIndex } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const br = await client.query('SELECT * FROM bets WHERE id=$1 FOR UPDATE', [id]);
    const bet = br.rows[0];
    if (!bet) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    if (bet.creator_id !== req.user.uid && !req.user.isAdmin) {
      await client.query('ROLLBACK'); return res.status(403).json({ error: 'Forbidden' }); }

    const pr = await client.query('SELECT * FROM bet_participants WHERE bet_id=$1', [id]);
    const winners = pr.rows.filter((p: any) => p.outcome_index === winnerOutcomeIndex);
    const losers  = pr.rows.filter((p: any) => p.outcome_index !== winnerOutcomeIndex);
    const winStake = winners.reduce((s: number, p: any) => s + p.stake, 0);

    await client.query(
      `UPDATE bets SET status='completed', winner_outcome_index=$1,
       resolved_at=NOW(), updated_at=NOW() WHERE id=$2`, [winnerOutcomeIndex, id]);

    for (const w of winners) {
      const share = winStake > 0 ? Math.floor((w.stake / winStake) * bet.total_pot) : 0;
      await client.query(
        'UPDATE users SET balance=balance+$1, wins=wins+1, last_bet_resolved_at=NOW() WHERE uid=$2',
        [share, w.user_id]);
      await insertNotification(client, w.user_id, 'resolved', 'Du hast gewonnen!',
        `Wette "${bet.title}" – Gewinn: ${share} BetCoins.`, id);
      sendSSE(w.user_id, 'balance_updated', {});
    }
    for (const l of losers) {
      await client.query(
        'UPDATE users SET losses=losses+1, last_bet_resolved_at=NOW() WHERE uid=$1', [l.user_id]);
      await insertNotification(client, l.user_id, 'resolved', 'Wette verloren',
        `Wette "${bet.title}" – Einsatz von ${l.stake} BetCoins verloren.`, id);
    }
    if (winners[0]) {
      await client.query(
        `INSERT INTO activities (user_id, user_name, type, bet_id, bet_title, outcome_name)
         VALUES ($1,$2,'bet_resolved',$3,$4,$5)`,
        [winners[0].user_id, winners[0].user_name, id, bet.title, bet.outcomes[winnerOutcomeIndex]]);
    }
    await client.query('COMMIT');

    const updated = await getBetById(id);
    broadcast('bets_updated', { action: 'updated', bet: updated });
    broadcast('activities_updated', {});
    for (const p of pr.rows) {
      const balR = await pool.query('SELECT balance FROM users WHERE uid=$1', [p.user_id]);
      if (balR.rows[0]) sendSSE(p.user_id, 'balance_updated', { balance: balR.rows[0].balance });
    }
    res.json(updated);
  } catch (e) {
    await client.query('ROLLBACK'); console.error(e);
    res.status(500).json({ error: 'DB error' });
  } finally { client.release(); }
});

app.post('/api/bets/:id/cancel', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const br = await client.query('SELECT * FROM bets WHERE id=$1 FOR UPDATE', [id]);
    const bet = br.rows[0];
    if (!bet) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    if (bet.creator_id !== req.user.uid && !req.user.isAdmin) {
      await client.query('ROLLBACK'); return res.status(403).json({ error: 'Forbidden' }); }
    const pr = await client.query('SELECT * FROM bet_participants WHERE bet_id=$1', [id]);
    for (const p of pr.rows)
      await client.query('UPDATE users SET balance=balance+$1 WHERE uid=$2', [p.stake, p.user_id]);
    await client.query(`UPDATE bets SET status='cancelled', updated_at=NOW() WHERE id=$1`, [id]);
    await client.query('COMMIT');

    const updated = await getBetById(id);
    broadcast('bets_updated', { action: 'updated', bet: updated });
    for (const p of pr.rows) {
      const balR = await pool.query('SELECT balance FROM users WHERE uid=$1', [p.user_id]);
      if (balR.rows[0]) sendSSE(p.user_id, 'balance_updated', { balance: balR.rows[0].balance });
    }
    res.json(updated);
  } catch (e) {
    await client.query('ROLLBACK'); console.error(e);
    res.status(500).json({ error: 'DB error' });
  } finally { client.release(); }
});

app.put('/api/bets/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, outcomes } = req.body;
  const br = await pool.query('SELECT creator_id FROM bets WHERE id=$1', [id]);
  if (!br.rows[0]) return res.status(404).json({ error: 'Not found' });
  if (br.rows[0].creator_id !== req.user.uid && !req.user.isAdmin)
    return res.status(403).json({ error: 'Forbidden' });
  await pool.query(
    'UPDATE bets SET title=$1, description=$2, outcomes=$3, updated_at=NOW() WHERE id=$4',
    [title, description, outcomes, id]
  );
  const bet = await getBetById(id);
  broadcast('bets_updated', { action: 'updated', bet });
  res.json(bet);
});

// ─── Notifications ────────────────────────────────────────────────────────────

app.get('/api/notifications', async (req, res) => {
  const r = await pool.query(
    'SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.user.uid]);
  res.json(r.rows.map(n => ({
    id: n.id, userId: n.user_id, type: n.type, title: n.title,
    message: n.message, betId: n.bet_id, read: n.read, createdAt: n.created_at,
  })));
});

app.put('/api/notifications/:id', async (req, res) => {
  await pool.query('UPDATE notifications SET read=$1 WHERE id=$2 AND user_id=$3',
    [req.body.read ?? true, req.params.id, req.user.uid]);
  res.json({ success: true });
});

app.put('/api/notifications', async (req, res) => {
  await pool.query('UPDATE notifications SET read=true WHERE user_id=$1 AND read=false', [req.user.uid]);
  res.json({ success: true });
});

app.delete('/api/notifications/:id', async (req, res) => {
  await pool.query('DELETE FROM notifications WHERE id=$1 AND user_id=$2', [req.params.id, req.user.uid]);
  res.json({ success: true });
});

// ─── Activities ───────────────────────────────────────────────────────────────

app.get('/api/activities', async (_req, res) => {
  const r = await pool.query('SELECT * FROM activities ORDER BY created_at DESC LIMIT 50');
  res.json(r.rows.map(a => ({
    id: a.id, userId: a.user_id, userName: a.user_name, type: a.type,
    betId: a.bet_id, betTitle: a.bet_title, amount: a.amount,
    outcomeName: a.outcome_name, createdAt: a.created_at,
  })));
});

// ─── Feature Requests ─────────────────────────────────────────────────────────

app.get('/api/feature-requests', async (_req, res) => {
  const r = await pool.query(
    'SELECT * FROM feature_requests ORDER BY array_length(upvotes,1) DESC NULLS LAST, created_at DESC');
  res.json(r.rows.map(f => ({
    ...f, userId: f.user_id, userName: f.user_name, createdAt: f.created_at,
  })));
});

app.post('/api/feature-requests', async (req, res) => {
  const { title, description } = req.body;
  const r = await pool.query(
    `INSERT INTO feature_requests (user_id, user_name, title, description)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.user.uid, req.user.name, title, description || '']);
  const f = r.rows[0];
  res.json({ ...f, userId: f.user_id, userName: f.user_name, createdAt: f.created_at });
});

app.put('/api/feature-requests/:id/upvote', async (req, res) => {
  const r = await pool.query('SELECT upvotes FROM feature_requests WHERE id=$1', [req.params.id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
  const upvotes: string[] = r.rows[0].upvotes || [];
  const newUpvotes = upvotes.includes(req.user.uid)
    ? upvotes.filter(u => u !== req.user.uid)
    : [...upvotes, req.user.uid];
  await pool.query('UPDATE feature_requests SET upvotes=$1 WHERE id=$2', [newUpvotes, req.params.id]);
  res.json({ upvotes: newUpvotes });
});

app.put('/api/feature-requests/:id/status', async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  await pool.query('UPDATE feature_requests SET status=$1 WHERE id=$2', [req.body.status, req.params.id]);
  res.json({ success: true });
});

// ─── Challenge Mode ───────────────────────────────────────────────────────────

app.get('/api/challenge-mode', async (_req, res) => {
  const r = await pool.query(`SELECT value FROM system_settings WHERE key='challengeMode'`);
  res.json(r.rows[0]?.value ?? { isActive: false, activatedAt: null, challengerBalance: 0 });
});

app.post('/api/challenge-mode/toggle', async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  const r = await pool.query(`SELECT value FROM system_settings WHERE key='challengeMode'`);
  const current = r.rows[0]?.value ?? { isActive: false, challengerBalance: 0 };
  const newVal = current.isActive
    ? { ...current, isActive: false }
    : { ...current, isActive: true, activatedAt: new Date().toISOString() };
  await pool.query(`UPDATE system_settings SET value=$1 WHERE key='challengeMode'`, [newVal]);
  broadcast('challenge_updated', newVal);
  res.json(newVal);
});

app.post('/api/challenge-mode/deduct', async (req, res) => {
  const { userId, newBalance, newChallengerBalance } = req.body;
  await pool.query(
    'UPDATE users SET balance=$1, last_challenge_deduction_at=$2 WHERE uid=$3',
    [newBalance, Date.now(), userId]);
  await pool.query(
    `UPDATE system_settings SET value=jsonb_set(value,'{challengerBalance}',$1::text::jsonb) WHERE key='challengeMode'`,
    [newChallengerBalance]);
  const balR = await pool.query('SELECT balance FROM users WHERE uid=$1', [userId]);
  if (balR.rows[0]) sendSSE(userId, 'balance_updated', { balance: balR.rows[0].balance });
  res.json({ success: true });
});

// ─── Admin Reset ──────────────────────────────────────────────────────────────

app.delete('/api/admin/reset', async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  const { resetBets, resetNotifications, resetUserStats } = req.body;
  if (resetBets) {
    await pool.query('DELETE FROM bet_participants');
    await pool.query('DELETE FROM bets');
    await pool.query('DELETE FROM activities');
  }
  if (resetNotifications) await pool.query('DELETE FROM notifications');
  if (resetUserStats) await pool.query('UPDATE users SET balance=1000, wins=0, losses=0');
  broadcast('bets_updated', { action: 'reset' });
  res.json({ success: true });
});

// ─── SSE ─────────────────────────────────────────────────────────────────────

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.write('event: connected\ndata: {}\n\n');

  const { uid } = req.user;
  if (!sseClients.has(uid)) sseClients.set(uid, new Set());
  sseClients.get(uid)!.add(res);

  const keepAlive = setInterval(() => { try { res.write(':ka\n\n'); } catch { /**/ } }, 25000);
  req.on('close', () => {
    clearInterval(keepAlive);
    const s = sseClients.get(uid);
    if (s) { s.delete(res); if (!s.size) sseClients.delete(uid); }
  });
});

// ─── Static / Vite ────────────────────────────────────────────────────────────

async function start() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  const PORT = Number(process.env.PORT ?? 3000);
  app.listen(PORT, '0.0.0.0', () => console.log(`BetBuddy on :${PORT}`));
}

start().catch(console.error);
