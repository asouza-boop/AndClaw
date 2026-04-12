import React from 'react';
import { Edit3, Trash2, Zap, Users, FileText, Brain } from 'lucide-react';

export interface Skill {
  _id?: string;
  id?: string;
  slug?: string;
  name?: string;
  description?: string;
  tools?: string[];
  sections?: string[];
  content?: string;
  integrations?: string[];
}

interface SkillCardProps {
  skill: Skill;
  onEdit: (s: Skill) => void;
  onDelete: (id: string) => void;
}

const integrationIcons: Record<string, any> = {
  agents: Users,
  meetings: FileText,
  memory: Brain,
};

export const SkillCard: React.FC<SkillCardProps> = ({ skill, onEdit, onDelete }) => {
  return (
    <div className="glass-card-v2 p-6 flex flex-col justify-between group h-64 transition-premium hover:border-primary/40">
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_12px_rgba(168,85,247,0.6)] animate-pulse" />
            <h4 className="text-sm font-black text-white tracking-widest uppercase truncate">{skill.name || skill.slug || 'Skill Node'}</h4>
          </div>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-premium translate-x-4 group-hover:translate-x-0">
            <button onClick={() => onEdit(skill)} className="p-2.5 rounded-xl bg-white/5 hover:bg-primary hover:text-white text-white/40 transition-premium">
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(skill._id || skill.id || '')} className="p-2.5 rounded-xl bg-rose-500/5 hover:bg-rose-500 hover:text-white text-rose-500/40 transition-premium">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="text-[12px] text-white/40 line-clamp-2 mb-6 italic leading-relaxed font-medium">
          {skill.description || 'No technical specification defined for this capability.'}
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          {(skill.tools || []).slice(0, 3).map((t, i) => (
            <span key={i} className="text-[9px] font-black tracking-widest px-3 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 uppercase">
              {t}
            </span>
          ))}
          {(skill.tools || []).length > 3 && (
            <span className="text-[9px] px-3 py-1 rounded-lg bg-white/5 text-white/20 font-black uppercase tracking-[0.2em]">
              +{skill.tools!.length - 3} VECTORS
            </span>
          )}
        </div>
      </div>

      {skill.integrations && skill.integrations.length > 0 && (
        <div className="flex items-center gap-4 pt-5 border-t border-white/5">
          {skill.integrations.map((ig) => {
            const Icon = integrationIcons[ig] || Zap;
            return (
              <div key={ig} className="flex items-center gap-2 text-[10px] font-black uppercase text-accent/60 tracking-[0.2em] hover:text-accent transition-premium">
                <Icon className="w-3.5 h-3.5" />
                <span>{ig}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
