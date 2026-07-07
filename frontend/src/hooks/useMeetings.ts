import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiUrl, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';

export interface Meeting {
  _id?: string;
  id?: string;
  title: string;
  date?: string;
  duration?: number;
  participants?: string[];
  status?: 'scheduled' | 'in_progress' | 'completed';
  transcript?: string;
  summary?: string;
  action_items?: ActionItem[];
  decisions?: string[];
  ideas?: string[];
  key_points?: string[];
  alerts?: Array<{ description: string; severity?: 'high' | 'medium' | 'low' }>;
  tasks_future?: Array<{ title: string; priority?: string; when?: string; owner?: string | null }>;
  memory_highlights?: string[];
  participants_identified?: Array<{ name: string; role?: string | null }>;
  skills_used?: string[];
  notes?: string;
}

export interface ActionItem {
  id?: string;
  text: string;
  assignee?: string;
  done?: boolean;
}

export interface Skill {
  _id?: string;
  id?: string;
  slug?: string;
  name?: string;
}

const authHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export function useMeetings() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data: meetings = [], isLoading: loadingMeetings } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => apiFetch('/api/meetings').catch(() => []).then(ensureArray),
  });

  const { data: skills = [], isLoading: loadingSkills } = useQuery({
    queryKey: ['skills'],
    queryFn: () => apiFetch('/api/skills').catch(() => []).then(ensureArray),
  });

  const deleteMeeting = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/api/meetings/${id}`), { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error('delete failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
      setSelected(null);
    },
  });

  const createMeeting = async (form: { title: string; date: string; duration: string; participants: string }) => {
    try {
      await apiFetch('/api/meetings', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          date: form.date || new Date().toISOString(),
          duration: parseInt(form.duration) || 30,
          participants: form.participants.split(',').map((s) => s.trim()).filter(Boolean),
          status: 'scheduled',
        }),
      });
      qc.invalidateQueries({ queryKey: ['meetings'] });
      toast('Reunião criada!', 'success');
      setCreateOpen(false);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const filtered = (meetings as Meeting[]).filter((m) => {
    if (!search) return true;
    return m.title.toLowerCase().includes(search.toLowerCase());
  });

  const currentMeeting = selected
    ? (meetings as Meeting[]).find((m) => (m._id || m.id) === (selected._id || selected.id)) || selected
    : null;

  return {
    meetings: meetings as Meeting[],
    skills: skills as Skill[],
    loadingMeetings,
    loadingSkills,
    selected,
    setSelected,
    search,
    setSearch,
    createOpen,
    setCreateOpen,
    deleteMeeting,
    createMeeting,
    filtered,
    currentMeeting,
  };
}
