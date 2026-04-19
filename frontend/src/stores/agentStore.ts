import { create } from 'zustand';

export type UIMode = 'normal' | 'debug';

export interface TraceStep {
  type: string;
  timestamp: string;
  status: 'start' | 'end' | 'success' | 'failure' | 'blocked' | 'hit' | 'miss' | 'pending';
  data?: Record<string, any>;
}

export interface ExecutionTrace {
  version: 'v1';
  steps: TraceStep[];
}

export interface SkillPerformance {
  skillId: string;
  score: number;
  successRate: number;
  avgLatencyMs: number;
  usageCount: number;
  lastComputed: string;
}

interface AgentState {
  uiMode: UIMode;
  isPaused: boolean;
  currentRequestId: string | null;
  currentTrace: ExecutionTrace | null;
  performanceData: SkillPerformance[];
  
  setUIMode: (mode: UIMode) => void;
  setPaused: (paused: boolean) => void;
  setCurrentRequestId: (id: string | null) => void;
  setTrace: (trace: ExecutionTrace | null) => void;
  setPerformanceData: (data: SkillPerformance[]) => void;
  
  // Feature Flags
  featureFlags: {
    UI_TRACE_ENHANCED: boolean;
    UI_MEMORY_INSPECTOR_V2: boolean;
    UI_LEARNING_INSIGHTS: boolean;
    AGENT_PRESENCE: boolean;
    MULTI_LLM: boolean;
    PROVIDER_ROUTING: boolean;
  };
  toggleFeatureFlag: (flag: 'UI_TRACE_ENHANCED' | 'UI_MEMORY_INSPECTOR_V2' | 'UI_LEARNING_INSIGHTS' | 'AGENT_PRESENCE' | 'MULTI_LLM' | 'PROVIDER_ROUTING') => void;
  
  // Real-time trace update helper
  addTraceStep: (step: TraceStep) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  uiMode: (localStorage.getItem('andclaw_ui_mode') as UIMode) || 'normal',
  isPaused: false,
  currentRequestId: null,
  currentTrace: null,
  performanceData: [],
  featureFlags: {
    UI_TRACE_ENHANCED: false,
    UI_MEMORY_INSPECTOR_V2: false,
    UI_LEARNING_INSIGHTS: false,
    AGENT_PRESENCE: false,
    MULTI_LLM: false,
    PROVIDER_ROUTING: false,
  },
  
  setUIMode: (mode) => {
    localStorage.setItem('andclaw_ui_mode', mode);
    set({ uiMode: mode });
  },
  setPaused: (paused) => set({ isPaused: paused }),
  setCurrentRequestId: (id) => set({ currentRequestId: id }),
  setTrace: (trace) => set({ currentTrace: trace }),
  setPerformanceData: (data) => set({ performanceData: data }),
  
  toggleFeatureFlag: (flag) => set((state) => ({
    featureFlags: {
      ...state.featureFlags,
      [flag]: !state.featureFlags[flag]
    }
  })),

  addTraceStep: (step) => set((state) => {
    if (!state.currentTrace) {
      return { 
        currentTrace: { version: 'v1', steps: [step] } 
      };
    }
    return {
      currentTrace: {
        ...state.currentTrace,
        steps: [...state.currentTrace.steps, step]
      }
    };
  }),
}));
