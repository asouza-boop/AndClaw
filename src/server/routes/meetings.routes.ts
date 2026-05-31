import { Router, Request, Response } from 'express';
import { query } from '@/db/postgres';
import { MeetingService } from '@/core/agent/MeetingService';
import { hasLLMConfig, offlineFallbackMessage } from '@/server/llm';
import { syncGoogleCalendars } from '@/integrations/googleCalendar';
import { agent, inferActionItems, mapMeetingRow } from './shared';
import { MemoryManager } from '@/memory/MemoryManager';

const router = Router();
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next);

router.post('/meetings', asyncHandler(async (req: Request, res: Response) => {
  const meeting = await MeetingService.create(req.body);
  res.status(201).json({ ok: true, item: mapMeetingRow(meeting), id: meeting?.id });
}));

router.post('/meetings/analyze', asyncHandler(async (req: Request, res: Response) => {
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
  await new MemoryManager().addSemanticMemory(reply, {
    source: 'meeting',
    meetingId: String(meetingId),
    type: 'meeting_insight',
    memoryType: 'operational'
  });

  res.json({ ok: true, insight: reply });
}));

router.get('/meetings/:id', asyncHandler(async (req: Request, res: Response) => {
  const rows = await query<any>(`SELECT * FROM meetings WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'meeting not found' });
  res.json({ ok: true, item: mapMeetingRow(rows[0]) });
}));

router.put('/meetings/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const meeting = await MeetingService.update(String(id), req.body);
  if (!meeting) return res.status(400).json({ error: 'nothing to update or meeting not found' });
  res.json({ ok: true, item: mapMeetingRow(meeting) });
}));

router.post('/meetings/:id/upload-audio', asyncHandler(async (req: Request, res: Response) => {
  return res.status(501).json({ error: 'Not yet implemented', code: 'STUB_ENDPOINT' });
}));

router.post('/meetings/:id/process', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { action = 'summarize' } = req.body || {};
  const rows = await query<any>(`SELECT * FROM meetings WHERE id = $1`, [id]);
  const meeting = rows[0];
  if (!meeting) return res.status(404).json({ error: 'meeting not found' });

  if (action === 'transcribe') {
    return res.status(501).json({ error: 'Not yet implemented', code: 'STUB_ENDPOINT' });
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
}));

router.get('/meetings', asyncHandler(async (_req: Request, res: Response) => {
  const rows = await query(`SELECT * FROM meetings ORDER BY created_at DESC LIMIT 200`);
  res.json({ ok: true, items: rows.map(mapMeetingRow) });
}));

router.get('/calendar/events', asyncHandler(async (_req: Request, res: Response) => {
  const rows = await query(
    `SELECT * FROM calendar_events ORDER BY start_time DESC LIMIT 200`
  );
  res.json({ ok: true, items: rows });
}));

router.get('/calendar/combined', asyncHandler(async (req: Request, res: Response) => {
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
}));

router.post('/calendar/sync', asyncHandler(async (_req: Request, res: Response) => {
  await syncGoogleCalendars();
  res.json({ ok: true });
}));

export default router;
