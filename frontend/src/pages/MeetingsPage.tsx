import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiUrl, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useState, useRef, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Plus, X, ArrowLeft, Calendar, Clock, Users, Zap,
  FileText, CheckSquare, Brain, Play, Pause, Mic, MicOff, Square,
  ChevronRight, Search, RotateCcw, Upload, Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

const statusConfig: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Agendada', color: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'Em andamento', color: 'bg-warn/15 text-warn' },
  completed: { label: 'Concluída', color: 'bg-success/15 text-success' },
};

function MeetingCard({ meeting, onClick }: { meeting: Meeting; onClick: () => void }) {
  const status = meeting.status || 'scheduled';
  const cfg = statusConfig[status] || statusConfig.scheduled;
  const date = meeting.date ? new Date(meeting.date) : null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl bg-card border border-border p-5 hover:border-primary/40 hover:shadow-[0_0_20px_-6px_hsl(var(--primary)/0.2)] transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-3">
        <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
          {meeting.title}
        </h4>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
        {date && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </span>
        )}
        {meeting.duration && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {meeting.duration}min
          </span>
        )}
        {meeting.participants && meeting.participants.length > 0 && (
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {meeting.participants.length}
          </span>
        )}
      </div>

      {meeting.action_items && meeting.action_items.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <CheckSquare className="w-3 h-3 text-accent" />
          <span className="text-muted-foreground">
            {meeting.action_items.filter(a => a.done).length}/{meeting.action_items.length} ações
          </span>
        </div>
      )}

      {meeting.skills_used && meeting.skills_used.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {meeting.skills_used.slice(0, 3).map((s, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {s}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function MeetingDetail({
  meeting,
  onBack,
  skills,
}: {
  meeting: Meeting;
  onBack: () => void;
  skills: Skill[];
}) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary' | 'actions' | 'skills'>('summary');
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

      // Get CSS variable for destructive color
      const style = getComputedStyle(document.documentElement);
      const destructive = style.getPropertyValue('--destructive').trim();
      ctx.strokeStyle = destructive ? `hsl(${destructive})` : '#ef4444';
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

      // Set up Web Audio API analyser for waveform
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

      // Start waveform after state updates
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
    const maxSize = 100 * 1024 * 1024; // 100MB
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
      
      // Auto-trigger transcription after upload
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
      toast(`${action === 'transcribe' ? 'Transcrição' : action === 'summarize' ? 'Resumo' : 'Action items'} gerados!`, 'success');
    } catch (err: any) {
      toast(err.message, 'error');
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
  const cfg = statusConfig[status] || statusConfig.scheduled;
  const date = meeting.date ? new Date(meeting.date) : null;

  const tabs = [
    { key: 'summary' as const, label: 'Resumo', icon: Brain },
    { key: 'transcript' as const, label: 'Transcrição', icon: FileText },
    { key: 'actions' as const, label: 'Ações', icon: CheckSquare },
    { key: 'skills' as const, label: 'Skills', icon: Zap },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{meeting.title}</h2>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                {' · '}
                {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {meeting.duration && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {meeting.duration}min
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
          </div>
        </div>
      </div>

      {/* Participants */}
      {meeting.participants && meeting.participants.length > 0 && (
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <div className="flex flex-wrap gap-1.5">
            {meeting.participants.map((p, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-foreground border border-border">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recording + Upload */}
      <div className="rounded-xl bg-card border border-border p-4 space-y-3">
        {/* Live Recorder */}
        {isRecording ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <span className="relative flex h-3 w-3">
                <span className={`absolute inline-flex h-full w-full rounded-full bg-destructive ${isPaused ? '' : 'animate-ping'} opacity-75`} />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
              </span>
              <span className="text-sm font-mono font-semibold text-foreground">{formatTime(recordingTime)}</span>
              <span className="text-xs text-muted-foreground">{isPaused ? 'Pausado' : 'Gravando...'}</span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={pauseRecording}
                  className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  title={isPaused ? 'Retomar' : 'Pausar'}
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                <button
                  onClick={stopRecording}
                  className="p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                  title="Parar e enviar"
                >
                  <Square className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Waveform */}
            <canvas
              ref={canvasRef}
              width={600}
              height={60}
              className="w-full h-[60px] rounded-lg bg-background/50"
            />
          </div>
        ) : (
          <button
            onClick={startRecording}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            <Mic className="w-4 h-4" />
            Gravar reunião ao vivo
          </button>
        )}

        {/* File Upload */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="rounded-lg border border-dashed border-border hover:border-primary/40 transition-colors p-3"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.webm,.ogg,.m4a,.mp4"
            onChange={handleFileSelect}
            className="hidden"
          />
          {uploading ? (
            <div className="flex items-center gap-3 justify-center py-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <div className="text-sm">
                <span className="text-foreground font-medium">{audioFileName}</span>
                <span className="text-muted-foreground ml-2">{uploadProgress}</span>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isRecording}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-primary disabled:opacity-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Ou arraste/clique para enviar áudio</span>
              <span className="text-[10px] text-muted-foreground/60">(até 100MB)</span>
            </button>
          )}
        </div>
      </div>

      {/* AI Actions Bar */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-card border border-border">
        <span className="text-xs text-muted-foreground mr-2">IA:</span>
        <button
          onClick={() => processWithAI('transcribe')}
          disabled={processing || uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
        >
          <Mic className="w-3 h-3" />
          Transcrever
        </button>
        <button
          onClick={() => processWithAI('summarize')}
          disabled={processing || uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 disabled:opacity-50 transition-colors"
        >
          <Brain className="w-3 h-3" />
          Resumir
        </button>
        <button
          onClick={() => processWithAI('extract_actions')}
          disabled={processing || uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20 disabled:opacity-50 transition-colors"
        >
          <CheckSquare className="w-3 h-3" />
          Extrair Ações
        </button>
        {processing && <span className="text-xs text-muted-foreground animate-pulse ml-2">Processando...</span>}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === 'summary' && (
          <div className="rounded-xl bg-card border border-border p-6">
            {meeting.summary ? (
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown>{meeting.summary}</ReactMarkdown>
              </div>
            ) : (
              <div className="text-center py-12">
                <Brain className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum resumo ainda.</p>
                <p className="text-xs text-muted-foreground mt-1">Clique em "Resumir" na barra de IA para gerar.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'transcript' && (
          <div className="rounded-xl bg-card border border-border p-6">
            {meeting.transcript ? (
              <div className="prose prose-sm prose-invert max-w-none font-mono text-xs leading-relaxed">
                <ReactMarkdown>{meeting.transcript}</ReactMarkdown>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma transcrição disponível.</p>
                <p className="text-xs text-muted-foreground mt-1">Clique em "Transcrever" para processar o áudio.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="rounded-xl bg-card border border-border p-6 space-y-3">
            {meeting.action_items && meeting.action_items.length > 0 ? (
              meeting.action_items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-lg bg-surface-2 border border-border hover:border-primary/20 transition-colors"
                >
                  <button
                    onClick={() => toggleAction(idx)}
                    className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      item.done
                        ? 'bg-success border-success text-success-foreground'
                        : 'border-muted-foreground/40 hover:border-primary'
                    }`}
                  >
                    {item.done && <span className="text-[10px]">✓</span>}
                  </button>
                  <div className="flex-1">
                    <p className={`text-sm ${item.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {item.text}
                    </p>
                    {item.assignee && (
                      <span className="text-[10px] text-muted-foreground mt-1 inline-block">
                        → {item.assignee}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <CheckSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma ação extraída.</p>
                <p className="text-xs text-muted-foreground mt-1">Clique em "Extrair Ações" para gerar automaticamente.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'skills' && (
          <div className="rounded-xl bg-card border border-border p-6">
            {/* Attached skills */}
            {meeting.skills_used && meeting.skills_used.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Skills vinculadas</h4>
                <div className="flex flex-wrap gap-2">
                  {meeting.skills_used.map((s, i) => (
                    <span key={i} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                      <Zap className="w-3 h-3" />
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Available skills to attach */}
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Vincular skill</h4>
            <div className="grid grid-cols-2 gap-2">
              {skills
                .filter((s: Skill) => !(meeting.skills_used || []).includes(s.name || s.slug || ''))
                .map((s: Skill, i) => (
                  <button
                    key={s._id || s.id || i}
                    onClick={() => attachSkill(s.name || s.slug || '')}
                    className="flex items-center gap-2 p-3 rounded-lg bg-surface-2 border border-border text-left hover:border-primary/30 hover:bg-surface-3 transition-all text-sm"
                  >
                    <Zap className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="truncate">{s.name || s.slug || 'Skill'}</span>
                  </button>
                ))}
              {skills.length === 0 && (
                <p className="col-span-2 text-xs text-muted-foreground text-center py-6">
                  Nenhuma skill disponível. Crie uma na página de Skills.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MeetingsPage() {
  const qc = useQueryClient();
  const { data: meetings = [] } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => apiFetch('/api/meetings').catch(() => []).then(ensureArray),
  });
  const { data: skills = [] } = useQuery({
    queryKey: ['skills'],
    queryFn: () => apiFetch('/api/skills').catch(() => []).then(ensureArray),
  });

  const [selected, setSelected] = useState<Meeting | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ title: '', date: '', duration: '30', participants: '' });

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

  // When selected meeting ID changes, update from fresh data
  const currentMeeting = selected
    ? meetings.find((m: Meeting) => (m._id || m.id) === (selected._id || selected.id)) || selected
    : null;

  if (currentMeeting) {
    return <MeetingDetail meeting={currentMeeting} onBack={() => setSelected(null)} skills={skills} />;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reuniões</h1>
          <p className="text-sm text-muted-foreground mt-1">Transcrição, resumo e ações automáticas com IA</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Nova Reunião
        </button>
      </div>

      {/* Search */}
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar reunião..."
          className="w-full pl-9 pr-4 py-2 rounded-lg bg-surface-2 border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      {/* Meeting list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((m: Meeting, i: number) => (
          <MeetingCard key={m._id || m.id || i} meeting={m} onClick={() => setSelected(m)} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center">
            <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? 'Nenhuma reunião encontrada' : 'Nenhuma reunião registrada.'}
            </p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-surface glow-border p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-semibold">Nova Reunião</h3>
              <button onClick={() => setCreateOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Título</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  placeholder="Ex: Daily Standup"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Data/Hora</label>
                  <input
                    type="datetime-local"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Duração (min)</label>
                  <input
                    type="number"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    className="w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Participantes (vírgula)</label>
                <input
                  value={form.participants}
                  onChange={(e) => setForm({ ...form, participants: e.target.value })}
                  className="w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  placeholder="João, Maria, Pedro"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setCreateOpen(false)} className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground">
                Cancelar
              </button>
              <button
                onClick={createMeeting}
                disabled={!form.title.trim()}
                className="px-4 py-1.5 rounded-md bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
