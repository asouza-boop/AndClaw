import { Router, Request, Response } from 'express';
import { query } from '@/db/postgres';
import { TaskService } from '@/core/agent/TaskService';
import { MeetingService } from '@/core/agent/MeetingService';
import { MemoryManager } from '@/memory/MemoryManager';
import { saveToRaindrop } from '@/integrations/raindrop';
import { config } from '@/config/env';
import { hasLLMConfig } from '@/server/llm';
import { agent } from './shared';
import { logger } from '@/infra/logger';

const router = Router();
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next);

router.post('/captures', asyncHandler(async (req: Request, res: Response) => {
  const body = req.body || {};
  // Accept 'title' as alias for 'content' (REST convention compatibility)
  const content = body.content || body.title;
  const { source = 'pwa', type = 'note', tags = [], project_id, due_date, metadata = {}, status = 'new' } = body;
  const VALID_TYPES = ['note', 'task', 'idea', 'link', 'meeting', 'project'];
  const safeType = VALID_TYPES.includes(type) ? type : 'note';
  if (!content) return res.status(400).json({ error: 'content is required', note: 'Also accepts title as alias for content' });
  const rows = await query(
    `INSERT INTO captures (content, source, type, tags, project_id, due_date, metadata, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [content, source, safeType, tags, project_id || null, due_date || null, JSON.stringify(metadata), status]
  );
  const row = rows[0];

  // Auto-create task or meeting
  if (row && type === 'task') {
    await TaskService.createFromCapture(row);
  }
  if (row && type === 'meeting') {
    await MeetingService.createFromCapture(row);
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
}));

router.post('/captures/smart', asyncHandler(async (req: Request, res: Response) => {
  const body = req.body || {};
  const content = body.content || body.title;
  const { source = 'pwa', project_id, metadata = {} } = body;
  
  if (!content) return res.status(400).json({ error: 'content is required' });

  // 1. Salvamento Síncrono Imediato (Fallback Seguro e Optimistic UI)
  const initialMetadata = { ...metadata, isProcessing: true };
  const rows = await query(
    `INSERT INTO captures (content, source, type, project_id, metadata, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [content, source, 'note', project_id || null, JSON.stringify(initialMetadata), 'processing']
  );
  const row = rows[0];

  // Retorna imediatamente para o frontend não travar
  res.status(201).json({
    ok: true,
    item: row,
    message: 'Captura salva, processamento em background iniciado.'
  });

  // 2. Processamento Assíncrono com LLM (Fire-and-forget)
  (async () => {
    try {
      if (!hasLLMConfig()) throw new Error('LLM not configured');

      const prompt = `Você é um motor de processamento cognitivo avançado ultrarrápido.
Analise a entrada e:
1. Classifica no campo "type": deve ser 'task', 'meeting', 'project', 'link', 'note' ou 'idea'.
2. Resume no campo "summary": um resumo executivo de 1 frase.
3. Sugere ações no campo "evolution": array de strings com caminhos curtos (ex: "Criar Tarefa", "Mover para Agenda", "Ferramenta").

Entrada: "${content}"

Retorne APENAS um JSON válido no formato exato:
{"type": "note", "summary": "...", "evolution": ["...", "..."]}`;

      const reply = await agent.processInput('pwa-user', prompt);
      let result: { type?: string; summary?: string; evolution?: string[] };
      try {
        const cleaned = reply.replace(/```json|```/g, '').trim();
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('NO_JSON_BLOCK');
        const parsed = JSON.parse(match[0]);
        if (!parsed || typeof parsed !== 'object') throw new Error('INVALID_SHAPE');
        result = {
          type: typeof parsed.type === 'string' ? parsed.type : 'note',
          summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
          evolution: Array.isArray(parsed.evolution) ? parsed.evolution : [],
        };
      } catch (parseErr: any) {
        logger.warn('capture.smart.parse_fallback', { captureId: row.id, error: parseErr.message });
        result = { type: 'note', summary: undefined, evolution: [] };
      }

      const updatedMetadata = { ...(metadata || {}), summary: result.summary, evolution: result.evolution };
      const newType = result.type || 'note';

      await query(
        `UPDATE captures SET type = $1, metadata = $2, status = 'new' WHERE id = $3`,
        [newType, JSON.stringify(updatedMetadata), row.id]
      );

      // Auto-save logic if applicable
      if (newType === 'task') {
         const taskRows = await query(`SELECT * FROM captures WHERE id = $1`, [row.id]);
         await TaskService.createFromCapture(taskRows[0]);
      }
      if (newType === 'meeting') {
         const meetingRows = await query(`SELECT * FROM captures WHERE id = $1`, [row.id]);
         await MeetingService.createFromCapture(meetingRows[0]);
      }
      if (newType === 'link' && config.raindrop.token) {
        const urlMatch = content.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          await saveToRaindrop(urlMatch[0], content.replace(urlMatch[0], '').trim() || undefined);
        }
      }

    } catch (err) {
      logger.error('capture.smart.async_failed', { captureId: row.id, error: (err as any).message });
      // Fallback seguro: retira o status de processing e volta para 'new' (sem metadados de IA)
      try {
        const fallbackMetadata = { ...(metadata || {}) };
        await query(
          `UPDATE captures SET metadata = $1, status = 'new' WHERE id = $2`,
          [JSON.stringify(fallbackMetadata), row.id]
        );
      } catch (dbErr) {
        logger.error('capture.smart.fallback_db_failed', { captureId: row.id, error: (dbErr as any).message });
      }
    }
  })();
}));

router.get('/captures', asyncHandler(async (req: Request, res: Response) => {
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
}));

router.patch('/captures/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, type, tags, project_id, due_date, metadata } = req.body || {};
  const VALID_TYPES = ['note', 'task', 'idea', 'link', 'meeting', 'project'];
  if (type !== undefined && !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Allowed: ${VALID_TYPES.join(', ')}` });
  }
  
  const oldRows = await query(`SELECT * FROM captures WHERE id = $1`, [id]);
  const oldRow = oldRows[0];
  const isTaskBridge = type === 'task' && oldRow?.type !== 'task';
  const isMeetingBridge = type === 'meeting' && oldRow?.type !== 'meeting';

  const updates: string[] = [];
  const params: any[] = [];

  if (status !== undefined && !(status === 'processed' && (isTaskBridge || isMeetingBridge))) {
    params.push(status);
    updates.push(`status = $${params.length}`);
  }
  if (type !== undefined) { params.push(type); updates.push(`type = $${params.length}`); }
  if (tags !== undefined) { params.push(tags); updates.push(`tags = $${params.length}`); }
  if (project_id !== undefined) { params.push(project_id); updates.push(`project_id = $${params.length}`); }
  if (due_date !== undefined) { params.push(due_date); updates.push(`due_date = $${params.length}`); }
  if (metadata !== undefined) { params.push(JSON.stringify(metadata)); updates.push(`metadata = $${params.length}`); }
  if (status === 'processed' && !(isTaskBridge || isMeetingBridge)) { updates.push(`processed_at = NOW()`); }

  if (updates.length === 0) return res.status(400).json({ error: 'nothing to update' });

  params.push(id);
  const rows = await query(
    `UPDATE captures SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  const newRow = rows[0];

  // If type evolved to task/meeting, auto-create
  if (oldRow && newRow) {
    if (isTaskBridge && newRow.type === 'task') {
      await TaskService.createFromCapture(newRow);
      await query(`UPDATE captures SET status = 'processed', processed_at = NOW() WHERE id = $1`, [id]);
      const finalRow = await query<any>(`SELECT * FROM captures WHERE id = $1`, [id]);
      return res.json({ ok: true, item: finalRow[0] });
    }
    if (isMeetingBridge && newRow.type === 'meeting') {
      await MeetingService.createFromCapture(newRow);
      await query(`UPDATE captures SET status = 'processed', processed_at = NOW() WHERE id = $1`, [id]);
      const finalRow = await query<any>(`SELECT * FROM captures WHERE id = $1`, [id]);
      return res.json({ ok: true, item: finalRow[0] });
    }
  }

  res.json({ ok: true, item: newRow });
}));

router.delete('/captures/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await query(`DELETE FROM captures WHERE id = $1`, [id]);
  res.json({ ok: true });
}));

router.post('/captures/bulk', asyncHandler(async (req: Request, res: Response) => {
  const { ids, action, type } = req.body || {};
  if (!ids?.length && action !== 'extract') return res.status(400).json({ error: 'ids and action required' });

  if (action === 'delete') {
    await query(`DELETE FROM captures WHERE id = ANY($1)`, [ids]);
  } else if (action === 'archive') {
    await query(`UPDATE captures SET status = 'archived', processed_at = NOW() WHERE id = ANY($1)`, [ids]);
  } else if (action === 'convert_task') {
    const items = await query<any>(`SELECT * FROM captures WHERE id = ANY($1)`, [ids]);
    for (const item of items) {
      await TaskService.createFromCapture({
        ...item,
        type: 'task',
        content: item.content,
      });
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
    let results: Array<{ id: number; category: string; title: string; content: string; priority: string }>;
    try {
      let jsonStr = reply.replace(/```json|```/g, '').trim();
      const match = jsonStr.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('NO_JSON_ARRAY');
      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed)) throw new Error('NOT_AN_ARRAY');
      results = parsed.filter((item: any) =>
        item && typeof item === 'object' && typeof item.id === 'number'
      );
      if (results.length === 0) throw new Error('EMPTY_RESULTS');
    } catch (e: any) {
      logger.error('capture.extract.parse_failed', { error: e.message, raw: reply });
      return res.status(500).json({ error: 'Falha na análise estruturada do agente', code: 'PARSE_FAILED' });
    }

    for (const resItem of results) {
      if (resItem.category === 'task') {
        await query(
          `INSERT INTO tasks (title, status, priority) VALUES ($1, 'open', $2)`,
          [resItem.title || 'Nova Tarefa', resItem.priority || 'normal']
        );
      } else {
        const mm = new MemoryManager();
        await mm.addSemanticMemory(
          resItem.content || resItem.title,
          { source: 'capture', captureId: String(resItem.id), type: 'ai_extraction', memoryType: 'operational' }
        );
      }
      await query(`UPDATE captures SET status = 'processed', processed_at = NOW() WHERE id = $1`, [resItem.id]);
    }
  }

  res.json({ ok: true });
}));

export default router;
