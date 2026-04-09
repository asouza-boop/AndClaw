export interface SkillContract {
  name: string;
  description: string;
  category?: 'integration' | 'cognitive' | 'meta';
  capability?: string;
  plannerEnabled?: boolean;
  intentTriggers?: string[];
  priority?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  status?: 'experimental' | 'active' | 'deprecated';
  [key: string]: any;
}
