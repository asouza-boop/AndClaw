import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiUrl, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useState, useRef, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Plus, X, ArrowLeft, Calendar, Clock, Users, Zap,
  FileText, CheckSquare, Brain, Play, Pause, Mic, MicOff, Square,
  ChevronRight, Search, RotateCcw, Upload, Loader2, BookOpen,
  Sparkles, Lightbulb, Target
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppSidebar } from '@/components/AppSidebar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/EmptyState';
import { MeetingsSkeleton } from '@/components/PageSkeletons';

interface Meeting {
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
  skills_used?: string[];
  notes?: string;
}

interface ActionItem {
  id?: string;
  text: string;
  assignee?: string;
  done?: boolean;
}

interface Skill {
  _id?: string;
  id?: string;
  slug?: string;
  name?: string;
}

const statusVariants: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  scheduled: { label: 'Agendada', variant: 'info' },
  in_progress: { label: 'Em andamento', variant: 'warning' },
  completed: { label: 'Concluída', variant: 'success' },
};

function MeetingCard({ meeting, onClick }: { meeting: Meeting; onClick: () => void }) {
  const status = meeting.status || 'scheduled';
  const cfg = statusVariants[status] || statusVariants.scheduled;
  const date = meeting.date ? new Date(meeting.date) : null;

  return (
    <Card padding="sm" border shadow="sm" onClick={onClick} className="group cursor-pointer">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', margin: 0 }} className="group-hover:text-primary transition-colors">
          {meeting.title}
        </h4>
        <Badge variant={cfg.variant}>{cfg.label}</Badge>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', fontSize: '10px', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-3)', fontFamily: 'var(--font-mono)' }}>
        {date && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <Calendar size={10} />
            {date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </span>
        )}
        {meeting.duration && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <Clock size={10} />
            {meeting.duration}m
          </span>
        )}
        {meeting.participants && meeting.participants.length > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <Users size={10} />
            {meeting.participants.length}
          </span>
        )}
      </div>

      {meeting.action_items && meeting.action_items.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '10px', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
          <CheckSquare size={10} style={{ color: 'var(--color-accent)' }} />
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {meeting.action_items.filter(a => a.done).length}/{meeting.action_items.length} ações
          </span>
        </div>
      )}

      {meeting.skills_used && meeting.skills_used.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 'var(--space-2)' }}>
          {meeting.skills_used.slice(0, 3).map((s, i) => (
            <Badge key={i} variant="primary" style={{ fontSize: '9px', padding: '1px 6px' }}>{s}</Badge>
          ))}
        </div>
      )}
    </Card>
  );
}

function MeetingDetail({
  meeting,
  onBack,
  skills,
  deleteMeeting,
}: {
  meeting: Meeting;
  onBack: () => void;
  skills: Skill[];
  deleteMeeting: { mutate: (id: number) => void; isPending: boolean };
}) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary' | 'intelligence' | 'skills'>('summary');
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [audioFileName, setAudioFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const id = meeting._id || meeting.id || '';

  // ── Recording state ──
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      audioCtxRef.current?.close();
    };
  }, []);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();

      const sliceWidth = w / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(w, h / 2);
      ctx.stroke();
    };
    draw();
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
        audioCtx.close();
        analyserRef.current = null;
        audioCtxRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const file = new File([blob], `gravacao_${Date.now()}.webm`, { type: mimeType });
        setIsRecording(false);
        setIsPaused(false);
        setRecordingTime(0);
        uploadAudio(file);
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);

      setTimeout(() => drawWaveform(), 100);
    } catch {
      toast('Permissão de microfone negada.', 'error');
    }
  }, [drawWaveform]);

  const pauseRecording = useCallback(() => {
    const r = mediaRecorderRef.current;
    if (!r) return;
    if (r.state === 'recording') {
      r.pause();
      setIsPaused(true);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    } else if (r.state === 'paused') {
      r.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const uploadAudio = async (file: File) => {
    if (!file) return;
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      toast('Arquivo muito grande. Máximo 100MB.', 'error');
      return;
    }
    const allowed = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/m4a', 'audio/mp4', 'audio/x-m4a', 'video/webm'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp3|wav|webm|ogg|m4a|mp4)$/i)) {
      toast('Formato não suportado. Use MP3, WAV, WebM, OGG ou M4A.', 'error');
      return;
    }

    setUploading(true);
    setUploadProgress('Enviando áudio...');
    setAudioFileName(file.name);

    try {
      const formData = new FormData();
      formData.append('audio', file);

      const token = localStorage.getItem('auth_token');
      const res = await fetch(apiUrl(`/api/meetings/${id}/upload-audio`), {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || `Erro ${res.status}`);
      }

      setUploadProgress('Áudio enviado! Transcrevendo...');
      await apiFetch(`/api/meetings/${id}/process`, {
        method: 'POST',
        body: JSON.stringify({ action: 'transcribe' }),
      });

      qc.invalidateQueries({ queryKey: ['meetings'] });
      toast('Áudio enviado e transcrição iniciada!', 'success');
      setActiveTab('transcript');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAudio(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) uploadAudio(file);
  };

  const processWithAI = async (action: string) => {
    setProcessing(true);
    try {
      await apiFetch(`/api/meetings/${id}/process`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      qc.invalidateQueries({ queryKey: ['meetings'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast(`${action === 'transcribe' ? 'Transcrição' : action === 'summarize' ? 'Resumo' : 'Ações extraídas e tarefas criadas!'}`, 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const generateKnowledge = async () => {
    if (!meeting.summary && !meeting.transcript) {
      toast('Gere um resumo ou transcrição antes de extrair conhecimento', 'warn');
      return;
    }

    setProcessing(true);
    try {
      const sections = [
        meeting.summary ? `## Resumo\n${meeting.summary}` : '',
        meeting.action_items?.length
          ? `## Ações\n${meeting.action_items
              .map((a) => `- [${a.done ? 'x' : ' '}] ${a.text}${a.assignee ? ` (@${a.assignee})` : ''}`)
              .join('\n')}`
          : '',
        meeting.transcript
          ? `## Transcrição\n${meeting.transcript.slice(0, 2000)}${
              meeting.transcript.length > 2000 ? '\n\n...(truncado)' : ''
            }`
          : '',
      ].filter(Boolean);

      await apiFetch('/api/knowledge', {
        method: 'POST',
        body: JSON.stringify({
          type: 'insight',
          title: `Insights: ${meeting.title}`,
          content: `# Insights: ${meeting.title}\n\n${sections.join('\n\n') || meeting.title}`,
          source_type: 'meeting',
          source_id: id,
        }),
      });

      qc.invalidateQueries({ queryKey: ['memory'] });
      toast('Conhecimento extraído!', 'success');
    } catch (err: any) {
      toast(err.message || 'Erro ao gerar conhecimento', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const toggleAction = async (actionIdx: number) => {
    try {
      const items = [...(meeting.action_items || [])];
      items[actionIdx] = { ...items[actionIdx], done: !items[actionIdx].done };
      await apiFetch(`/api/meetings/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ action_items: items }),
      });
      qc.invalidateQueries({ queryKey: ['meetings'] });
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const attachSkill = async (skillSlug: string) => {
    try {
      const current = meeting.skills_used || [];
      if (current.includes(skillSlug)) return;
      await apiFetch(`/api/meetings/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ skills_used: [...current, skillSlug] }),
      });
      qc.invalidateQueries({ queryKey: ['meetings'] });
      toast('Skill vinculada!', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const status = meeting.status || 'scheduled';
  const cfg = statusVariants[status] || statusVariants.scheduled;
  const date = meeting.date ? new Date(meeting.date) : null;

  const tabs = [
    { key: 'summary' as const, label: 'Resumo', icon: Brain },
    { key: 'transcript' as const, label: 'Transcrição', icon: FileText },
    { key: 'intelligence' as const, label: 'Inteligência', icon: Sparkles },
    { key: 'skills' as const, label: 'Skills', icon: Zap },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Detail Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <Button variant="ghost" size="sm" onClick={onBack} style={{ width: '32px', height: '32px', padding: 0 }}>
          <ArrowLeft size={16} />
        </Button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>{meeting.title}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-1)', fontSize: '10px', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            {date && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <Calendar size={10} />
                {date.toLocaleDateString('pt-BR')} {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {meeting.duration && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <Clock size={10} />
                {meeting.duration}m
              </span>
            )}
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
          </div>
        </div>
        <button
          onClick={() => { if (confirm('Excluir esta reunião?')) deleteMeeting.mutate(Number(id)); }}
          disabled={deleteMeeting.isPending}
          style={{ color: 'var(--color-error, #ef4444)', background: 'transparent', border: 'none', fontSize: 'var(--text-sm)', cursor: 'pointer' }}
          title="Excluir reunião"
        >
          {deleteMeeting.isPending ? 'Excluindo...' : 'Excluir'}
        </button>
      </div>

      {/* Detail Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 'var(--space-6)' }} className="lg:grid-cols-[1fr_320px]">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* AI Action Bar */}
          <Card padding="sm" border shadow="sm">
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: '10px', fontWeight: 'var(--font-bold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginRight: 'var(--space-2)' }}>Ações IA</span>
              <Button variant="ghost" size="sm" onClick={() => processWithAI('transcribe')} disabled={processing || uploading} style={{ fontSize: '11px', color: 'var(--color-accent)' }}>
                <Mic size={14} className="mr-2" /> Transcrever
              </Button>
              <Button variant="ghost" size="sm" onClick={() => processWithAI('summarize')} disabled={processing || uploading} style={{ fontSize: '11px', color: 'var(--color-info)' }}>
                <Brain size={14} className="mr-2" /> Resumir
              </Button>
              <Button variant="ghost" size="sm" onClick={() => processWithAI('extract_actions')} disabled={processing || uploading} style={{ fontSize: '11px', color: 'var(--color-success)' }}>
                <CheckSquare size={14} className="mr-2" /> Extrair Ações
              </Button>
              <Button variant="ghost" size="sm" onClick={generateKnowledge} disabled={processing || uploading} style={{ fontSize: '11px', color: 'var(--color-warning)' }}>
                <BookOpen size={14} className="mr-2" /> Gerar Insights
              </Button>
              {processing && <Loader2 size={14} className="animate-spin ml-auto" />}
            </div>
          </Card>

          {/* Main Content Area (Tabs) */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', gap: 'var(--space-2)' }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as any)}
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-medium)',
                  color: activeTab === t.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                  borderBottom: activeTab === t.key ? '2px solid var(--color-accent)' : '2px solid transparent',
                  transition: 'all var(--transition-base)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)'
                }}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ minHeight: '400px' }}>
            {activeTab === 'summary' && (
              <Card padding="lg" border shadow="sm">
                {meeting.summary ? (
                  <div className="prose prose-sm prose-invert max-w-none" style={{ color: 'var(--color-text-secondary)' }}>
                    <ReactMarkdown>{meeting.summary}</ReactMarkdown>
                  </div>
                ) : (
                  <EmptyState icon={<Brain size={40} />} title="Sem resumo" description="Gere um resumo utilizando a barra de IA acima." />
                )}
              </Card>
            )}

            {activeTab === 'transcript' && (
              <Card padding="lg" border shadow="sm">
                {meeting.transcript ? (
                  <div className="prose prose-sm prose-invert max-w-none" style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                    <ReactMarkdown>{meeting.transcript}</ReactMarkdown>
                  </div>
                ) : (
                  <EmptyState icon={<FileText size={40} />} title="Sem transcrição" description="Transcreva o áudio da reunião para ver o texto completo." />
                )}
              </Card>
            )}

            {activeTab === 'intelligence' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <Card padding="lg" border shadow="sm">
                  <h4 style={{ fontSize: '10px', fontWeight: 'var(--font-bold)', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <CheckSquare size={14} /> Ações Extraídas
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {meeting.action_items?.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-tertiary)' }}>
                        <button 
                          onClick={() => toggleAction(idx)}
                          style={{ 
                            width: '16px', height: '16px', borderRadius: '4px', border: '1px solid var(--color-border)', 
                            backgroundColor: item.done ? 'var(--color-success)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px'
                          }}
                        >
                          {item.done && '✓'}
                        </button>
                        <span style={{ fontSize: 'var(--text-sm)', color: item.done ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)', textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</span>
                      </div>
                    ))}
                    {!meeting.action_items?.length && <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Nenhuma ação identificada.</p>}
                  </div>
                </Card>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-6)' }}>
                  <Card padding="md" border shadow="sm" style={{ borderColor: 'var(--color-success-border)' }}>
                    <h4 style={{ fontSize: '10px', fontWeight: 'var(--font-bold)', textTransform: 'uppercase', color: 'var(--color-success)', marginBottom: 'var(--space-3)' }}>Decisões</h4>
                    <ul style={{ paddingLeft: 'var(--space-4)', margin: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                      {meeting.decisions?.map((d, i) => <li key={i} style={{ marginBottom: 'var(--space-2)' }}>{d}</li>)}
                    </ul>
                  </Card>
                  <Card padding="md" border shadow="sm" style={{ borderColor: 'var(--color-warning-border)' }}>
                    <h4 style={{ fontSize: '10px', fontWeight: 'var(--font-bold)', textTransform: 'uppercase', color: 'var(--color-warning)', marginBottom: 'var(--space-3)' }}>Insights</h4>
                    <ul style={{ paddingLeft: 'var(--space-4)', margin: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                      {meeting.ideas?.map((d, i) => <li key={i} style={{ marginBottom: 'var(--space-2)' }}>{d}</li>)}
                    </ul>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'skills' && (
              <Card padding="lg" border shadow="sm">
                <h4 style={{ fontSize: '10px', fontWeight: 'var(--font-bold)', textTransform: 'uppercase', color: 'var(--color-info)', marginBottom: 'var(--space-4)' }}>Skills Utilizadas</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-8)' }}>
                  {meeting.skills_used?.map((s, i) => <Badge key={i} variant="primary">{s}</Badge>)}
                  {!meeting.skills_used?.length && <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Nenhuma skill vinculada.</p>}
                </div>

                <h4 style={{ fontSize: '10px', fontWeight: 'var(--font-bold)', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>Vincular Skill</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}>
                  {skills.filter(s => !(meeting.skills_used || []).includes(s.name || s.slug || '')).map((s, i) => (
                    <Button key={i} variant="ghost" size="sm" onClick={() => attachSkill(s.name || s.slug || '')} style={{ justifyContent: 'flex-start', fontSize: '11px' }}>
                      <Zap size={14} className="mr-2" /> {s.name || s.slug}
                    </Button>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Detail Sidebar (Recording/Upload) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <Card padding="lg" border shadow="sm">
            <h4 style={{ fontSize: '11px', fontWeight: 'var(--font-bold)', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>Gravação / Upload</h4>
              
            {isRecording ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)', backgroundColor: 'var(--color-error-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-error-border)' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--color-error)', animation: isPaused ? 'none' : 'pulse 1s infinite' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-error)' }}>{formatTime(recordingTime)}</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)' }}>
                    <Button variant="ghost" size="sm" onClick={pauseRecording} style={{ color: 'var(--color-error)' }}>{isPaused ? <Play size={14} /> : <Pause size={14} />}</Button>
                    <Button variant="ghost" size="sm" onClick={stopRecording} style={{ color: 'var(--color-error)' }}><Square size={14} /></Button>
                  </div>
                </div>
                <canvas ref={canvasRef} width={280} height={40} style={{ width: '100%', height: '40px', backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-sm)' }} />
              </div>
            ) : (
              <Button variant="primary" onClick={startRecording} disabled={uploading} style={{ width: '100%', backgroundColor: 'var(--color-error)', borderColor: 'var(--color-error)' }}>
                <Mic size={16} className="mr-2" /> Iniciar Gravação
              </Button>
            )}

            <div 
              style={{ 
                marginTop: 'var(--space-4)', padding: 'var(--space-4)', border: '1px dashed var(--color-border)', 
                borderRadius: 'var(--radius-md)', textAlign: 'center', cursor: 'pointer' 
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" hidden onChange={handleFileSelect} accept="audio/*" />
              {uploading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
                  <Loader2 size={14} className="animate-spin" />
                  <span style={{ fontSize: '10px' }}>{uploadProgress}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
                  <Upload size={20} style={{ color: 'var(--color-text-tertiary)' }} />
                  <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>Upload de arquivo (MP3, WAV)</span>
                </div>
              )}
            </div>
          </Card>

          {meeting.participants && meeting.participants.length > 0 && (
            <Card padding="lg" border shadow="sm">
              <h4 style={{ fontSize: '11px', fontWeight: 'var(--font-bold)', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>Participantes</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {meeting.participants.map((p, i) => (
                  <span key={i} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)' }}>{p}</span>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MeetingsPage() {
  const qc = useQueryClient();
  const { data: meetings = [], isLoading: loadingMeetings } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => apiFetch('/api/meetings').catch(() => []).then(ensureArray),
  });
  const { data: skills = [], isLoading: loadingSkills } = useQuery({
    queryKey: ['skills'],
    queryFn: () => apiFetch('/api/skills').catch(() => []).then(ensureArray),
  });

  const [selected, setSelected] = useState<Meeting | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ title: '', date: '', duration: '30', participants: '' });
  const authHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

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

  const createMeeting = async () => {
    try {
      await apiFetch('/api/meetings', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          date: form.date || new Date().toISOString(),
          duration: parseInt(form.duration) || 30,
          participants: form.participants.split(',').map(s => s.trim()).filter(Boolean),
          status: 'scheduled',
        }),
      });
      qc.invalidateQueries({ queryKey: ['meetings'] });
      toast('Reunião criada!', 'success');
      setCreateOpen(false);
      setForm({ title: '', date: '', duration: '30', participants: '' });
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const filtered = meetings.filter((m: Meeting) => {
    if (!search) return true;
    return m.title.toLowerCase().includes(search.toLowerCase());
  });

  const currentMeeting = selected
    ? meetings.find((m: Meeting) => (m._id || m.id) === (selected._id || selected.id)) || selected
    : null;

  if (loadingMeetings || loadingSkills) {
    return <MeetingsSkeleton />;
  }

  return (
    <AppLayout sidebar={<AppSidebar />}>
      {currentMeeting ? (
        <MeetingDetail meeting={currentMeeting} onBack={() => setSelected(null)} skills={skills} deleteMeeting={deleteMeeting} />
      ) : (
        <>
          <PageHeader 
            title="Reuniões" 
            subtitle="Gestão de inteligência conversacional"
            actions={
              <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus size={14} className="mr-2" /> Nova Reunião
              </Button>
            }
          />

          <div style={{ marginTop: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <div style={{ flex: 1, maxWidth: '400px' }}>
                <Input placeholder="Buscar reuniões..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                {filtered.length} reuniões
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
              {filtered.map((m: Meeting, i: number) => (
                <MeetingCard key={m._id || m.id || i} meeting={m} onClick={() => setSelected(m)} />
              ))}
              {filtered.length === 0 && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <EmptyState 
                    icon={<Calendar size={40} />}
                    title={search ? "Nenhuma reunião encontrada" : "Agenda Vazia"}
                    description={search ? "Tente buscar por outro termo." : "Crie sua primeira reunião para começar a extrair inteligência."}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Create Modal */}
      {createOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropBlur: '4px' }}>
          <Card padding="lg" border shadow="md" style={{ width: '100%', maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>Nova Reunião</h3>
              <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}><X size={16} /></Button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Input label="Título" placeholder="Ex: Daily Standup" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>Data/Hora</label>
                  <input 
                    type="datetime-local" 
                    value={form.date} 
                    onChange={(e) => setForm({ ...form, date: e.target.value })} 
                    style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)', outline: 'none' }} 
                  />
                </div>
                <Input label="Duração (min)" type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
              </div>

              <Input label="Participantes" placeholder="João, Maria (vírgula)" value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-8)' }}>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button variant="primary" onClick={createMeeting} disabled={!form.title.trim()}>Criar Reunião</Button>
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
