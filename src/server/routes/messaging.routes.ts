import { Router, Request, Response } from 'express';
import { query } from '@/db/postgres';
import { ensureSchema } from '@/db/schema';
import { hasLLMConfig } from '@/server/llm';
import { agent } from './shared';

const router = Router();

router.post('/messages', async (req: Request, res: Response) => {
  const { content, conversationId = 'default', client_message_id, sender, role } = req.body || {};
  const resolvedRole = role || sender || 'user';
  if (!content) return res.status(400).json({ error: 'content is required' });

  await ensureSchema();
  await query(`INSERT INTO conversations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [conversationId]);

  const rows = await query(
    `INSERT INTO messages (conversation_id, role, content, client_message_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (client_message_id) DO NOTHING
     RETURNING *`,
    [conversationId, resolvedRole, content, client_message_id || null]
  );
  res.status(201).json({ ok: true, id: rows[0]?.id, message: rows[0] || null, item: rows[0] || null });
});

router.get('/messages', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
  const rows = await query(
    `SELECT * FROM messages ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  res.json({ ok: true, items: rows });
});

router.get('/messages/by-conversation/:id', async (req: Request, res: Response) => {
  const conversationId = req.params.id;
  const limit = Math.min(parseInt((req.query.limit as string) || '200', 10), 500);
  const rows = await query(
    `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT $2`,
    [conversationId, limit]
  );
  res.json({ ok: true, items: rows });
});

router.get('/messages/:id/trace', async (req: Request, res: Response) => {
  const { id } = req.params;
  const rows = await query<any>(`SELECT trace FROM messages WHERE id = $1`, [id]);
  if (!rows[0]) return res.status(404).json({ error: 'message not found' });
  res.json({ ok: true, trace: rows[0].trace });
});

router.get('/conversations/:id/latest-trace', async (req: Request, res: Response) => {
  const { id } = req.params;
  const rows = await query<any>(
    `SELECT trace FROM messages 
     WHERE conversation_id = $1 AND role = 'assistant' 
     ORDER BY created_at DESC LIMIT 1`, 
    [id]
  );
  res.json({ ok: true, trace: rows[0]?.trace || null });
});

router.post('/skill-chat', async (req: Request, res: Response) => {
  const { system, messages } = req.body || {};
  if (!messages?.length) return res.status(400).json({ error: 'messages required' });
  if (!hasLLMConfig()) {
    return res.json({ ok: true, reply: 'LLM não configurado. Configure GEMINI_API_KEY nas variáveis de ambiente do backend (Render).' });
  }
  try {
    const historyText = messages.slice(0, -1).map((m: any) =>
      `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`
    ).join('\n\n');
    const lastUserMsg = messages[messages.length - 1]?.content || '';
    const fullInput = system
      ? `${system}\n\n${historyText ? '--- Histórico da conversa ---\n' + historyText + '\n\n--- Nova mensagem do usuário ---\n' : ''}${lastUserMsg}`
      : lastUserMsg;

    const reply = await agent.processInput('skill-creator', fullInput, {});
    res.json({ ok: true, reply });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message || 'Erro no LLM' });
  }
});

export default router;
