import { Router, Request, Response } from 'express';
import { query } from '@/db/postgres';
import { MeetingService } from '@/core/agent/MeetingService';
import { hasLLMConfig, offlineFallbackMessage } from '@/server/llm';
import { syncGoogleCalendars } from '@/integrations/googleCalendar';
import { agent, inferActionItems, mapMeetingRow } from './shared';

const router = Router();

router.post('/meetings', async (req: Request, res: Response) => {
  const {
    title,
    meeting_date,
    date,
    transcript_text,
    transcript,
    status = 'scheduled',
    duration = null,
    participants = [],
    summary = null,
    action_items = [],
    skills_used = [],
    notes = null,
  } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title is required' });
  const rows = await query(
    `INSERT INTO meetings (title, meeting_date, transcript_text, status, duration, participants, summary, action_items, skills_used, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10) RETURNING *`,
    [
      title,
      meeting_date || date || null,
      transcript_text || transcript || null,
      status,
      duration,
      participants,
      summary,
      JSON.stringify(action_items || []),
      skills_used,
      notes,
    ]
  );
  res.status(201).json({ ok: true, item: mapMeetingRow(rows[0]), id: rows[0]?.id });
});

router.post('/meetings/analyze', async (req: Request, res: Response) => {
  const { meetingId } = req.body || {};
  if (!meetingId) return res.status(400).json({ error: 'meetingId is required' });

  const rows = await query<any>('SELECT * FROM meetings WHERE id = $1', [meetingId]);
  const meeting = rows[0];
  if (!meeting) return res.status(404).json({ error: 'meeting not found' });

  if (!hasLLMConfig()) {
    return res.json({ ok: true, insight: offlineFallbackMessage(), offline: true });
  }

  const prompt = `Analise a transcricao a seguir e extraia:\n- Principais decisoes\n- Proximas acoes\n- Riscos e pendencias\n- Insights estrategicos\n\nTranscricao:\n${meeting.transcript_text || ''}`;

  const reply = await agent.processInput('pwa-user', prompt);
  await query(`UPDATE meetings SET summary = $1 WHERE id = $2`, [reply, meetingId]);
  await query(
    `INSERT INTO memory_items (type, content, source_type, source_id)
     VALUES ($1, $2, $3, $4)`,
    ['meeting_insight', reply, 'meeting', String(meetingId)]
  );

  res.json({ ok: true, insight: reply });
});

router.get('/meetings/:id', async (req: Request, res: Response) => {
  const rows = await query<any>(`SELECT * FROM meetings WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'meeting not found' });
  res.json({ ok: true, item: mapMeetingRow(rows[0]) });
});

router.put('/meetings/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, date, meeting_date, transcript, transcript_text, status, duration, participants, summary, action_items, skills_used, notes } = req.body || {};
  const updates: string[] = [];
  const params: any[] = [];
  if (title !== undefined) { params.push(title); updates.push(`title = $${params.length}`); }
  if (date !== undefined || meeting_date !== undefined) { params.push(meeting_date || date || null); updates.push(`meeting_date = $${params.length}`); }
  if (transcript !== undefined || transcript_text !== undefined) { params.push(transcript_text || transcript || null); updates.push(`transcript_text = $${params.length}`); }
  if (status !== undefined) { params.push(status); updates.push(`status = $${params.length}`); }
  if (duration !== undefined) { params.push(duration); updates.push(`duration = $${params.length}`); }
  if (participants !== undefined) { params.push(participants); updates.push(`participants = $${params.length}`); }
  if (summary !== undefined) { params.push(summary); updates.push(`summary = $${params.length}`); }
  if (action_items !== undefined) { params.push(JSON.stringify(action_items)); updates.push(`action_items = $${params.length}::jsonb`); }
  if (skills_used !== undefined) { params.push(skills_used); updates.push(`skills_used = $${params.length}`); }
  if (notes !== undefined) { params.push(notes); updates.push(`notes = $${params.length}`); }
  if (!updates.length) return res.status(400).json({ error: 'nothing to update' });
  params.push(id);
  const rows = await query<any>(`UPDATE meetings SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
  res.json({ ok: true, item: mapMeetingRow(rows[0]) });
});

router.post('/meetings/:id/upload-audio', async (req: Request, res: Response) => {
  const { id } = req.params;
  const rows = await query<any>(
    `UPDATE meetings
     SET audio_file_name = COALESCE(audio_file_name, 'upload-received'), status = 'in_progress'
     WHERE id = $1 RETURNING *`,
    [id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'meeting not found' });
  res.json({ ok: true, item: mapMeetingRow(rows[0]) });
});

router.post('/meetings/:id/process', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { action = 'summarize' } = req.body || {};
  const rows = await query<any>(`SELECT * FROM meetings WHERE id = $1`, [id]);
  const meeting = rows[0];
  if (!meeting) return res.status(404).json({ error: 'meeting not found' });

  if (action === 'transcribe') {
    const transcript = meeting.transcript_text || `Áudio recebido para "${meeting.title}". Transcrição automática ainda não está configurada no backend.`;
    const updated = await query<any>(`UPDATE meetings SET transcript_text = $1, status = 'in_progress' WHERE id = $2 RETURNING *`, [transcript, id]);
    return res.json({ ok: true, item: mapMeetingRow(updated[0]) });
  }

  if (!meeting.transcript_text) {
    return res.status(400).json({ error: 'meeting transcript not available' });
  }

  if (!hasLLMConfig()) {
    if (action === 'extract_actions') {
      const actionItems = inferActionItems(meeting.transcript_text);
      const updated = await query<any>(`UPDATE meetings SET action_items = $1::jsonb WHERE id = $2 RETURNING *`, [JSON.stringify(actionItems), id]);
      return res.json({ ok: true, item: mapMeetingRow(updated[0]), offline: true });
    }
    const summary = offlineFallbackMessage();
    const updated = await query<any>(`UPDATE meetings SET summary = $1, status = 'completed' WHERE id = $2 RETURNING *`, [summary, id]);
    return res.json({ ok: true, item: mapMeetingRow(updated[0]), offline: true });
  }

  if (action === 'extract_actions') {
    await MeetingService.processIntelligence(id, meeting.transcript_text, agent);
    
    const updatedRows = await query<any>(`SELECT * FROM meetings WHERE id = $1`, [id]);
    return res.json({ ok: true, item: mapMeetingRow(updatedRows[0]) });
  }

  const prompt = `Resuma a reunião abaixo em markdown com decisões, riscos e próximos passos.\n\n${meeting.transcript_text}`;
  const reply = await agent.processInput('pwa-user', prompt);
  const updated = await query<any>(`UPDATE meetings SET summary = $1, status = 'completed' WHERE id = $2 RETURNING *`, [reply, id]);
  res.json({ ok: true, item: mapMeetingRow(updated[0]) });
});

router.get('/meetings', async (_req: Request, res: Response) => {
  const rows = await query(`SELECT * FROM meetings ORDER BY created_at DESC LIMIT 200`);
  res.json({ ok: true, items: rows.map(mapMeetingRow) });
});

router.get('/calendar/events', async (_req: Request, res: Response) => {
  const rows = await query(
    `SELECT * FROM calendar_events ORDER BY start_time DESC LIMIT 200`
  );
  res.json({ ok: true, items: rows });
});

router.get('/calendar/combined', async (req: Request, res: Response) => {
  const from = (req.query.from as string) || new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
  const to = (req.query.to as string) || new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

  const events = await query(
    `SELECT 'event' as type, summary as title, start_time as start, end_time as end
     FROM calendar_events
     WHERE start_time BETWEEN $1 AND $2
     ORDER BY start_time ASC`,
    [from, to]
  );

  const tasks = await query(
    `SELECT 'task' as type, title, due_date as start, due_date as end
     FROM tasks
     WHERE due_date BETWEEN $1 AND $2
     ORDER BY due_date ASC`,
    [from, to]
  );

  res.json({ ok: true, items: [...events, ...tasks] });
});

router.post('/calendar/sync', async (_req: Request, res: Response) => {
  await syncGoogleCalendars();
  res.json({ ok: true });
});

export default router;
