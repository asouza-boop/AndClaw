import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { config } from '@/config/env';
import { parseSkillDocument } from './shared';
import { SkillLoader } from '@/skills/SkillLoader';

const router = Router();

async function listSkillsFromDisk() {
  const root = config.paths.skills;
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const file = path.join(root, slug, 'SKILL.md');
    let content = '';
    try {
      content = await fs.readFile(file, 'utf-8');
      const parsed = parseSkillDocument(slug, content);
      const sectionCount = (content.match(/^##\s/gm) || []).length;
      skills.push({
        slug,
        id: slug,
        title: parsed.title,
        name: slug,
        description: parsed.description,
        allowedTools: parsed.allowedTools,
        tools: parsed.allowedTools,
        content,
        sectionCount,
        hasContent: content.length > 100,
      });
    } catch {}
  }
  return skills;
}

async function createSkillOnDisk(slug: string, title: string, description: string, content: string, allowedTools: string[]) {
  const root = config.paths.skills;
  const skillDir = path.join(root, slug);
  await fs.mkdir(skillDir, { recursive: true });
  const toolsLine = allowedTools.length ? `allowed-tools: ${allowedTools.join(', ')}` : '';
  const md = `---
name: ${slug}
description: ${description}
${toolsLine}
---

# ${title}

${content}
`;
  await fs.writeFile(path.join(skillDir, 'SKILL.md'), md, 'utf-8');
}

async function updateSkillOnDisk(slug: string, content: string) {
  const file = path.join(config.paths.skills, slug, 'SKILL.md');
  await fs.writeFile(file, content, 'utf-8');
}

async function deleteSkillOnDisk(slug: string) {
  const skillDir = path.join(config.paths.skills, slug);
  await fs.rm(skillDir, { recursive: true, force: true });
}

router.get('/skills', async (_req: Request, res: Response) => {
  const skills = await listSkillsFromDisk();
  res.json({ ok: true, items: skills });
});

router.post('/skills', async (req: Request, res: Response) => {
  const body = req.body || {};
  const slug = body.slug || body.name;
  const title = body.title || body.name || slug;
  const { description, content = '', allowedTools = [] } = body;
  if (!slug || !title) return res.status(400).json({ error: 'slug/name and title are required', required_fields: ['slug (or name)', 'title'], optional_fields: ['description', 'content', 'allowedTools'] });
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  await createSkillOnDisk(safeSlug, title, description || title, content, allowedTools);
  SkillLoader.invalidateAll();
  res.status(201).json({ ok: true, slug: safeSlug, name: safeSlug, title, id: safeSlug });
});

router.put('/skills/:id', async (req: Request, res: Response) => {
  const slug = String(req.params.id);
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'content is required' });
  await updateSkillOnDisk(slug, String(content));
  SkillLoader.invalidate(slug);
  res.json({ ok: true, id: slug });
});

router.delete('/skills/:id', async (req: Request, res: Response) => {
  const slug = String(req.params.id);
  await deleteSkillOnDisk(slug);
  SkillLoader.invalidate(slug);
  res.json({ ok: true, id: slug });
});

export default router;
