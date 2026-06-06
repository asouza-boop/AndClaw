import { Router, Request, Response } from 'express';
import { query } from '@/db/postgres';
import { config } from '@/config/env';
import { hasLLMConfig, offlineFallbackMessage } from '@/server/llm';
import { setEntityTags, agent, parseSkillDocument } from './shared';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

const asyncHandler = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

async function listSkillsFromDisk() {
  const root = config.paths.skills;
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const skills: any[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const file = path.join(root, slug, 'SKILL.md');
    try {
      const content = await fs.readFile(file, 'utf-8');
      const parsed = parseSkillDocument(slug, content);
      skills.push({
        slug,
        id: slug,
        title: parsed.title,
        name: slug,
        description: parsed.description,
        allowedTools: parsed.allowedTools,
        tools: parsed.allowedTools,
        content,
        sectionCount: (content.match(/^##\s/gm) || []).length,
        hasContent: content.length > 100,
      });
    } catch {}
  }
  return skills;
}

router.get('/agents', asyncHandler(async (_req: Request, res: Response) => {
  const agents = await query<any>(`SELECT * FROM agents ORDER BY created_at DESC`);
  const skills = await query<any>(`SELECT agent_id, skill_slug FROM agent_skills`);
  const tags = await query<any>(
    `SELECT et.entity_id, t.name, t.color
     FROM entity_tags et
     JOIN tags t ON t.id = et.tag_id
     WHERE et.entity_type = 'agent'`
  );

  const skillMap = new Map<string, string[]>();
  skills.forEach((row: any) => {
    const key = String(row.agent_id);
    const list = skillMap.get(key) || [];
    list.push(row.skill_slug);
    skillMap.set(key, list);
  });

  const tagMap = new Map<string, any[]>();
  tags.forEach((row: any) => {
    const key = String(row.entity_id);
    const list = tagMap.get(key) || [];
    list.push({ name: row.name, color: row.color });
    tagMap.set(key, list);
  });

  const items = agents.map((agent: any) => ({
    ...agent,
    skills: skillMap.get(String(agent.id)) || [],
    tags: tagMap.get(String(agent.id)) || [],
  }));
  res.json({ ok: true, items });
}));

router.post('/agents', asyncHandler(async (req: Request, res: Response) => {
  const { name, level, status, areas = [], description, base_doc, skills = [], tags = [], personality = 50 } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const rows = await query<any>(
    `INSERT INTO agents (name, level, status, areas, description, base_doc, personality)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [name, level || 'Estrategico', status || 'ativo', areas, description || null, base_doc || null, personality]
  );
  const agentRow = rows[0];

  for (const skill of skills) {
    await query(
      `INSERT INTO agent_skills (agent_id, skill_slug)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [agentRow.id, String(skill)]
    );
  }

  await setEntityTags(query, 'agent', String(agentRow.id), tags);

  res.status(201).json({
    ok: true,
    item: agentRow,
    id: agentRow?.id,
    name: agentRow?.name,
    level: agentRow?.level,
    status: agentRow?.status,
  });
}));

router.patch('/agents/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, level, status, areas, description, base_doc, personality } = req.body || {};
  const updates: string[] = [];
  const params: any[] = [];
  if (name)        { params.push(name);        updates.push(`name = $${params.length}`); }
  if (level)       { params.push(level);       updates.push(`level = $${params.length}`); }
  if (status)      { params.push(status);      updates.push(`status = $${params.length}`); }
  if (areas)       { params.push(areas);       updates.push(`areas = $${params.length}`); }
  if (description !== undefined) { params.push(description); updates.push(`description = $${params.length}`); }
  if (base_doc !== undefined)    { params.push(base_doc);    updates.push(`base_doc = $${params.length}`); }
  if (personality !== undefined) { params.push(personality); updates.push(`personality = $${params.length}`); }
  if (!updates.length) return res.status(400).json({ error: 'nothing to update' });
  params.push(id);
  const rows = await query<any>(`UPDATE agents SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
  res.json({ ok: true, item: rows[0] });
}));

router.delete('/agents/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await query(`DELETE FROM agents WHERE id = $1`, [id]);
  res.json({ ok: true });
}));

router.post('/agents/:id/tags', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  const { tags = [] } = req.body || {};
  await setEntityTags(query, 'agent', String(id), tags);
  res.json({ ok: true });
}));

router.post('/agents/:id/skills', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  const { skills = [] } = req.body || {};
  await query(`DELETE FROM agent_skills WHERE agent_id = $1`, [id]);
  for (const skill of skills) {
    await query(
      `INSERT INTO agent_skills (agent_id, skill_slug)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [id, String(skill)]
    );
  }
  res.json({ ok: true });
}));

router.post('/agents/:id/execute', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { skill_id, skill_ids, task_id, task_title, task_description } = req.body || {};

  const agentRows = await query<any>(`SELECT * FROM agents WHERE id = $1`, [id]);
  const agentRow = agentRows[0];
  if (!agentRow) return res.status(404).json({ error: 'agent not found' });

  const taskRows = task_id
    ? await query<any>(`SELECT * FROM tasks WHERE id = $1`, [task_id])
    : [];
  const task = taskRows[0];

  const requestedSkillIds = Array.isArray(skill_ids) && skill_ids.length
    ? skill_ids
    : skill_id
      ? [skill_id]
      : Array.isArray(task?.skill_ids) && task.skill_ids.length
        ? task.skill_ids
        : [];

  if (!requestedSkillIds.length) {
    return res.status(400).json({ error: 'skill_id is required' });
  }

  const availableSkills = await listSkillsFromDisk();
  const outputs: any[] = [];
  const scopedUserId = `automation:${id}:${task?.id || task_id || 'manual'}`;
  const taskLabel = task?.title || task_title || 'Tarefa';
  const taskNotes = task?.description || task_description || '';

  for (const rawSkillId of requestedSkillIds) {
    const normalizedSkillId = String(rawSkillId);
    const skill = availableSkills.find((s: any) =>
      s.slug === normalizedSkillId ||
      s.id === normalizedSkillId ||
      s.name === normalizedSkillId ||
      s.title === normalizedSkillId
    );

    if (!skill) {
      outputs.push({
        skill_id: normalizedSkillId,
        ok: false,
        error: 'skill not found',
      });
      continue;
    }

    if (!hasLLMConfig()) {
      outputs.push({
        skill_id: normalizedSkillId,
        ok: true,
        offline: true,
        reply: offlineFallbackMessage(),
        skill: { id: skill.id, slug: skill.slug, title: skill.title },
      });
      continue;
    }

    const prompt = [
      `Você é o agente "${agentRow.name || agentRow.title || 'Agente'}".`,
      `Execute a skill "${skill.title}" com foco na tarefa concluída abaixo.`,
      '',
      `Tarefa: ${taskLabel}`,
      taskNotes ? `Descrição: ${taskNotes}` : '',
      '',
      'Conteúdo da skill:',
      skill.content,
      '',
      'Responda de forma objetiva com resultado, próximos passos e riscos.',
    ].filter(Boolean).join('\n');

    const reply = await agent.processInput(scopedUserId, prompt, {
      source: 'task_done_automation',
      agentId: id,
      taskId: task?.id || task_id || null,
      skillId: skill.slug,
    });

    outputs.push({
      skill_id: normalizedSkillId,
      ok: true,
      reply,
      skill: { id: skill.id, slug: skill.slug, title: skill.title },
    });
  }

  res.json({
    ok: true,
    agent: { id: agentRow.id, name: agentRow.name, level: agentRow.level, status: agentRow.status },
    task: task ? { id: task.id, title: task.title, status: task.status } : null,
    items: outputs,
    offline: !hasLLMConfig(),
  });
}));

export default router;
