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
    <div className="glass-card p-6 flex flex-col justify-between group h-56 transition-all duration-300">
      <div>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 glass-glow-accent shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
            <h4 className="text-sm font-black text-white tracking-tight uppercase truncate">{skill.name || skill.slug || 'Skill'}</h4>
          </div>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
            <button onClick={() => onEdit(skill)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all">
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(skill._id || skill.id || '')} className="p-2 rounded-xl bg-destructive/5 hover:bg-destructive/20 text-white/50 hover:text-destructive transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="text-[11px] text-white/40 line-clamp-2 mb-4 italic leading-relaxed">
          {skill.description || 'Nenhuma descrição técnica disponível.'}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {(skill.tools || []).slice(0, 3).map((t, i) => (
            <span key={i} className="text-[9px] font-black tracking-tighter px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20 uppercase">
              {t}
            </span>
          ))}
          {(skill.tools || []).length > 3 && (
            <span className="text-[9px] px-2 py-0.5 rounded-lg bg-white/5 text-white/30 font-bold uppercase tracking-widest">
              +{skill.tools!.length - 3} TOOLS
            </span>
          )}
        </div>
      </div>

      {skill.integrations && skill.integrations.length > 0 && (
        <div className="flex items-center gap-3 pt-4 border-t border-white/5">
          {skill.integrations.map((ig) => {
            const Icon = integrationIcons[ig] || Zap;
            return (
              <div key={ig} className="flex items-center gap-1.5 text-[9px] font-black uppercase text-accent tracking-widest opacity-60 hover:opacity-100 transition-opacity">
                <Icon className="w-3 h-3" />
                <span>{ig}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
