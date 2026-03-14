import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { config } from '../config/env';

export interface SkillMetadata {
  name: string;
  description: string;
  [key: string]: any;
}

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

  public fetchSkills(): Skill[] {
    const skills: Skill[] = [];
    
    try {
      const entries = fs.readdirSync(this.skillsPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const mdPath = path.join(this.skillsPath, entry.name, 'SKILL.md');
          
          if (fs.existsSync(mdPath)) {
            const fileContent = fs.readFileSync(mdPath, 'utf-8');
            const parsed = this.parseFrontmatter(fileContent);
            if (parsed) {
              skills.push({
                metadata: parsed.metadata,
                content: fileContent,
                folderName: entry.name
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('[SkillLoader] Error reading skills directory', e);
    }
    
    return skills;
  }

  private parseFrontmatter(content: string): { metadata: SkillMetadata, markdown: string } | null {
    const regex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(regex);
    
    if (match) {
      try {
        const metadata = yaml.load(match[1]) as SkillMetadata;
        if (metadata.name && metadata.description) {
           return { metadata, markdown: match[2] };
        }
      } catch (e) {
         console.warn('[SkillLoader] YAML Parse Error:', e);
      }
    }
    return null;
  }
}
