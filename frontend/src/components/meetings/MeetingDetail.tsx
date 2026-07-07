import { useState, useRef, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft, Calendar, Clock, Brain, Play, Pause, Mic, Square,
  Upload, Loader2, BookOpen, Sparkles, CheckSquare, Zap, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiFetch, apiUrl } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { Meeting, Skill } from '@/hooks/useMeetings';
import { statusVariants } from './MeetingCard';

export function MeetingDetail({
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

  const IntelligencePanel = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* KEY POINTS */}
      {meeting.key_points?.length > 0 && (
        <Card padding="md" border shadow="sm">
          <section>
            <h4>🎯 Pontos Principais</h4>
            <ul>
              {meeting.key_points.map((p: string, i: number) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </section>
        </Card>
      )}

      {/* ALERTS */}
      {meeting.alerts?.length > 0 && (
        <Card padding="md" border shadow="sm">
          <section>
            <h4>⚠️ Alertas</h4>
            {meeting.alerts.map((a: any, i: number) => (
              <div key={i} data-severity={a.severity}>
                <span>{a.severity === 'high' ? '🔴' : a.severity === 'medium' ? '🟡' : '🟢'}</span>
                <span>{a.description}</span>
              </div>
            ))}
          </section>
        </Card>
      )}

      {/* FUTURE ACTIONS */}
      {meeting.tasks_future?.length > 0 && (
        <Card padding="md" border shadow="sm">
          <section>
            <h4>📅 Ações Futuras</h4>
            {meeting.tasks_future.map((t: any, i: number) => (
              <div key={i}>
                <span>{t.title}</span>
                {t.when && <span style={{ opacity: 0.6 }}> — {t.when}</span>}
                {t.owner && <span style={{ opacity: 0.6 }}> ({t.owner})</span>}
              </div>
            ))}
          </section>
        </Card>
      )}

      {/* IDEAS */}
      {meeting.ideas?.length > 0 && (
        <Card padding="md" border shadow="sm">
          <section>
            <h4>💡 Ideias</h4>
            <ul>
              {meeting.ideas.map((idea: string, i: number) => (
                <li key={i}>{idea}</li>
              ))}
            </ul>
          </section>
        </Card>
      )}

      {/* DECISIONS */}
      {meeting.decisions?.length > 0 && (
        <Card padding="md" border shadow="sm">
          <section>
            <h4>✅ Decisões</h4>
            <ul>
              {meeting.decisions.map((d: string, i: number) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </section>
        </Card>
      )}

      {/* MEMORY HIGHLIGHTS */}
      {meeting.memory_highlights?.length > 0 && (
        <Card padding="md" border shadow="sm">
          <section>
            <h4>🧠 Para Lembrar</h4>
            <ul>
              {meeting.memory_highlights.map((m: string, i: number) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </section>
        </Card>
      )}

      {/* PARTICIPANTS IDENTIFIED */}
      {meeting.participants_identified?.length > 0 && (
        <Card padding="md" border shadow="sm">
          <section>
            <h4>👥 Participantes Identificados</h4>
            {meeting.participants_identified.map((p: any, i: number) => (
              <div key={i}>
                <strong>{p.name}</strong>
                {p.role && <span style={{ opacity: 0.6 }}> — {p.role}</span>}
              </div>
            ))}
          </section>
        </Card>
      )}
    </div>
  );
}
