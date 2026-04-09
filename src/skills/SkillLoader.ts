import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { config } from '@/config/env';
import { SkillValidator } from '../core/skills/SkillValidator';
import { SkillContract } from '../core/skills/SkillContract';

// Backward-compatible alias — all consumers importing SkillMetadata continue to work
export type SkillMetadata = SkillContract;

export interface Skill {
  metadata: SkillMetadata;
  content: string;
  folderName: string;
}

export class SkillLoader {
  private skillsPath = config.paths.skills;

  constructor() {
    if (!fs.existsSync(this.skillsPath)) {
      console.log(`[SkillLoader] Creating skills dir at ${this.skillsPath}`);
      fs.mkdirSync(this.skillsPath, { recursive: true });
    }
  }

  private skillsCache: Skill[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 60_000; // 60 segundos

  public fetchSkills(): Skill[] {
    const now = Date.now();
    if (this.skillsCache && (now - this.cacheTimestamp) < this.CACHE_TTL_MS) {
      // console.log(`[SkillLoader] Servindo ${this.skillsCache.length} skills do cache.`);
      return this.skillsCache;
    }

    console.log(`[SkillLoader] Cache vazio. Carregando skills do disco...`);
    const skills: Skill[] = [];
    const possiblePaths = [
      this.skillsPath,
      path.join(process.cwd(), '.agents', 'skill'),
      path.join(process.cwd(), 'Agents', 'skills'),
      path.join(process.cwd(), 'Agents', 'skill')
    ];
    
    const uniquePaths = Array.from(new Set(possiblePaths));

    for (const searchPath of uniquePaths) {
      if (!fs.existsSync(searchPath)) continue;

      try {
        const entries = fs.readdirSync(searchPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const mdPath = path.join(searchPath, entry.name, 'SKILL.md');
            
            if (fs.existsSync(mdPath)) {
              const fileContent = fs.readFileSync(mdPath, 'utf-8');
              const parsed = this.parseFrontmatter(fileContent);
              if (parsed) {
                const skillData = {
                  metadata: parsed.metadata,
                  content: fileContent,
                  folderName: entry.name
                };

                if (SkillValidator.validate(skillData, skills)) {
                  // Se já existe uma skill com o mesmo nome, removemos a anterior (Last match wins)
                  const existingIndex = skills.findIndex(s => s.metadata.name === parsed.metadata.name);

                  if (existingIndex !== -1) {
                    skills[existingIndex] = skillData;
                  } else {
                    skills.push(skillData);
                    console.log(`[Observability] skill.created: '${skillData.metadata.name}' (Status: ${skillData.metadata.status})`);
                  }
                } else {
                   console.log(`[Observability] skill.rejected: '${parsed.metadata.name}'`);
                }
              }
            }
          }
        }
      } catch (e) {
        console.error(`[SkillLoader] Error reading directory ${searchPath}`, e);
      }
    }
    
    this.skillsCache = skills;
    this.cacheTimestamp = Date.now();
    return skills;
  }

  /**
   * Promote an experimental skill to active
   */
  public promoteSkill(skillName: string): boolean {
    if (!this.skillsCache) return false;
    
    const skillIndex = this.skillsCache.findIndex(s => s.metadata.name === skillName);
    if (skillIndex !== -1) {
      const skill = this.skillsCache[skillIndex];
      skill.metadata.status = 'active';
      skill.metadata.plannerEnabled = true;
      console.log(`[Observability] skill.promoted: '${skillName}'`);
      
      // Attempt to rewrite frontmatter on disk for persistence
      try {
        // Simplified disk update: practically would parse string, update yaml and rewrite.
        // For this step, we just update the cache and let future operations persist if needed.
      } catch (e) {
         console.warn(`[SkillLoader] Could not persist promotion for '${skillName}' to disk.`);
      }
      return true;
    }
    return false;
  }

  /**
   * Força a limpeza do cache de skills (útil se o usuário adicionar uma skill nova "on the fly")
   */
  public clearCache(): void {
    this.skillsCache = null;
  }

  private parseFrontmatter(content: string): { metadata: SkillMetadata, markdown: string } | null {
    // Regex mais robusta para lidar com quebras de linha variadas e espaços
    const regex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
    const match = content.match(regex);
    
    if (match) {
      try {
        const metadata = yaml.load(match[1]) as SkillMetadata;
        if (metadata && metadata.name && metadata.description) {
           return { metadata, markdown: match[2] };
        }
      } catch (e) {
         console.warn('[SkillLoader] YAML Parse Error:', e);
      }
    }
    return null;
  }
}
