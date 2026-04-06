import { useNotificationStore, type Notification } from '@/stores/notificationStore';
import { Bell, MessageSquare, AlertTriangle, CheckCircle2, Calendar, Bot, X, CheckCheck } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const iconMap: Record<string, any> = {
  message: MessageSquare,
  alert: AlertTriangle,
  task: CheckCircle2,
  meeting: Calendar,
  agent: Bot,
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function NotificationPanel() {
  const { items, open, setOpen, markRead, markAllRead, unreadCount } = useNotificationStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, setOpen]);

  if (!open) return null;

  const handleClick = (n: Notification) => {
    markRead(n.id);
    if (n.link) navigate(n.link);
    setOpen(false);
  };

  return (
    <div 
      ref={panelRef} 
      className="absolute right-0 top-full mt-3 w-80 max-h-[480px] rounded-xl bg-surface border border-white/[0.08] shadow-2xl z-[60] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05] bg-surface-2/50 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Notificações</h3>
          {unreadCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-bold">{unreadCount}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button 
              onClick={markAllRead} 
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-surface-3"
            >
              <CheckCheck className="w-3 h-3" />
              Lido
            </button>
          )}
          <button 
            onClick={() => setOpen(false)} 
            className="p-1 rounded-md hover:bg-surface-3 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {items.length === 0 ? (
          <div className="py-12 text-center opacity-40">
            <Bell className="w-8 h-8 mx-auto mb-2" />
            <p className="text-xs">Nenhuma notificação</p>
          </div>
        ) : (
          items.map((n) => {
            const Icon = iconMap[n.type] || Bell;
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full flex items-start gap-3 px-4 py-4 text-left transition-colors border-b border-white/[0.03] last:border-0 ${!n.read ? 'bg-primary/[0.03] hover:bg-primary/[0.05]' : 'hover:bg-surface-2'}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${!n.read ? 'bg-primary/20 text-primary' : 'bg-surface-3 text-muted-foreground'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm truncate ${!n.read ? 'font-semibold text-foreground' : 'text-muted-foreground text-xs'}`}>{n.title}</p>
                    {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">{n.body}</p>
                  <p className="text-[9px] text-muted-foreground/60 mt-1 uppercase tracking-tight font-medium">{timeAgo(n.createdAt)}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
