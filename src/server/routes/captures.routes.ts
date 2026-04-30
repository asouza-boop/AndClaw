import { Router, Request, Response } from 'express';
import { query } from '@/db/postgres';
import { TaskService } from '@/core/agent/TaskService';
import { saveToRaindrop } from '@/integrations/raindrop';
import { config } from '@/config/env';
import { hasLLMConfig } from '@/server/llm';
import { agent } from './shared';

const router = Router();

router.post('/captures', async (req: Request, res: Response) => {
  const body = req.body || {};
  // Accept 'title' as alias for 'content' (REST convention compatibility)
  const content = body.content || body.title;
  const { source = 'pwa', type = 'note', tags = [], project_id, due_date, metadata = {}, status = 'new' } = body;
  if (!content) return res.status(400).json({ error: 'content is required', note: 'Also accepts title as alias for content' });
  const rows = await query(
    `INSERT INTO captures (content, source, type, tags, project_id, due_date, metadata, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [content, source, type, tags, project_id || null, due_date || null, JSON.stringify(metadata), status]
  );
  const row = rows[0];

  // Auto-create task if capture type is 'task'
  if (row && type === 'task') {
    await TaskService.createFromCapture(row);
  }

  // Auto-save link to Raindrop.io
  if (row && type === 'link' && config.raindrop.token) {
    const urlMatch = content.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      await saveToRaindrop(urlMatch[0], content.replace(urlMatch[0], '').trim() || undefined);
    }
  }

  res.status(201).json({
    ok: true,
    item: row,
    id: row?.id,
    title: body.title || row?.content,
    content: row?.content,
    type: row?.type,
    status: row?.status,
  });
});

router.get('/captures', async (req: Request, res: Response) => {
  const { type, status } = req.query as { type?: string; status?: string };
  let sql = `SELECT * FROM captures WHERE 1=1`;
  const params: any[] = [];
  if (type) { params.push(type); sql += ` AND type = $${params.length}`; }
  if (status) { params.push(status); sql += ` AND status = $${params.length}`; }
  sql += ` ORDER BY created_at DESC LIMIT 200`;
  const rows = await query(sql, params);
  const fmt = (req as any).query?.format;
  if (fmt === 'array') return res.json(rows);
  res.json({ ok: true, items: rows, captures: rows });
});

router.patch('/captures/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, type, tags, project_id, due_date, metadata } = req.body || {};
  const updates: string[] = [];
  const params: any[] = [];

  if (status !== undefined) { params.push(status); updates.push(`status = $${params.length}`); }
  if (type !== undefined) { params.push(type); updates.push(`type = $${params.length}`); }
  if (tags !== undefined) { params.push(tags); updates.push(`tags = $${params.length}`); }
  if (project_id !== undefined) { params.push(project_id); updates.push(`project_id = $${params.length}`); }
  if (due_date !== undefined) { params.push(due_date); updates.push(`due_date = $${params.length}`); }
  if (metadata !== undefined) { params.push(JSON.stringify(metadata)); updates.push(`metadata = $${params.length}`); }
  if (status === 'processed') { updates.push(`processed_at = NOW()`); }

  if (updates.length === 0) return res.status(400).json({ error: 'nothing to update' });

  params.push(id);
  const rows = await query(
    `UPDATE captures SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  res.json({ ok: true, item: rows[0] });
});

router.delete('/captures/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await query(`DELETE FROM captures WHERE id = $1`, [id]);
  res.json({ ok: true });
});

router.post('/captures/bulk', async (req: Request, res: Response) => {
  const { ids, action, type } = req.body || {};
  if (!ids?.length && action !== 'extract') return res.status(400).json({ error: 'ids and action required' });

  if (action === 'delete') {
    await query(`DELETE FROM captures WHERE id = ANY($1)`, [ids]);
  } else if (action === 'archive') {
    await query(`UPDATE captures SET status = 'archived', processed_at = NOW() WHERE id = ANY($1)`, [ids]);
  } else if (action === 'convert_task') {
    const items = await query<any>(`SELECT * FROM captures WHERE id = ANY($1)`, [ids]);
    for (const item of items) {
      await query(
        `INSERT INTO tasks (title, status, priority) VALUES ($1, 'open', 'normal')`,
        [item.content]
      );
    }
    await query(`UPDATE captures SET status = 'processed', processed_at = NOW() WHERE id = ANY($1)`, [ids]);
  } else if (action === 'set_type' && type) {
    await query(`UPDATE captures SET type = $1 WHERE id = ANY($2)`, [type, ids]);
  } else if (action === 'extract') {
    const targetIds = ids?.length ? ids : null;
    let items;
    if (targetIds) {
      items = await query<any>(`SELECT * FROM captures WHERE id = ANY($1) AND status != 'processed'`, [targetIds]);
    } else {
      items = await query<any>(`SELECT * FROM captures WHERE status != 'processed' LIMIT 20`);
    }

    if (!items.length) return res.json({ ok: true, message: 'Nada para processar' });

    if (!hasLLMConfig()) {
      return res.status(500).json({ error: 'LLM não configurada para extração automática' });
    }

    const inputData = items.map((it: any, idx: number) => `${idx + 1}. [ID:${it.id}] ${it.content}`).join('\n');
    const prompt = `Analise os itens capturados abaixo e categorize cada um. 
Responda APENAS em JSON no formato: [{"id": x, "category": "task"|"knowledge", "title": "título curto", "content": "conteúdo formatado markdown", "priority": "high"|"normal"|"low"}]

Contexto:
- "task": Algo acionável (Gerar tarefa).
- "knowledge": Informação, ideia ou nota (Gerar item de memória/conhecimento).

Itens:
${inputData}`;

    const reply = await agent.processInput('pwa-user', prompt);
    let results;
    try {
      const jsonStr = reply.replace(/```json|```/g, '').trim();
      results = JSON.parse(jsonStr);
    } catch (e) {
      console.error('[extract] Failed to parse agent JSON:', reply);
      return res.status(500).json({ error: 'Falha na análise estruturada do agente', raw: reply });
    }

    for (const resItem of results) {
      if (resItem.category === 'task') {
        await query(
          `INSERT INTO tasks (title, status, priority) VALUES ($1, 'open', $2)`,
          [resItem.title || 'Nova Tarefa', resItem.priority || 'normal']
        );
      } else {
        await query(
          `INSERT INTO memory_items (type, content, source_type, source_id)
           VALUES ($1, $2, $3, $4)`,
          ['ai_extraction', resItem.content || resItem.title, 'capture', String(resItem.id)]
        );
      }
      await query(`UPDATE captures SET status = 'processed', processed_at = NOW() WHERE id = $1`, [resItem.id]);
    }
  }

  res.json({ ok: true });
});

export default router;
