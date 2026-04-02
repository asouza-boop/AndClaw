import { Search, Plus, ListTodo, Video, Bell } from 'lucide-react';
import { useState } from 'react';
import { QuickCaptureModal } from './QuickCaptureModal';
import { NotificationPanel } from './NotificationPanel';
import { useNotificationStore } from '@/stores/notificationStore';

interface TopbarProps {
  title: string;
}

export function Topbar({ title }: TopbarProps) {
  const [captureOpen, setCaptureOpen] = useState(false);
  const { unreadCount, toggle } = useNotificationStore();

  return (
    <>
      <header className="h-14 flex items-center justify-between px-6 border-b border-white/[0.07] bg-surface/50 backdrop-blur-sm shrink-0">
        <h1 className="text-lg font-semibold">{title}</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar..."
              className="pl-9 pr-4 py-1.5 rounded-md bg-surface-2 border border-white/[0.07] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 w-48"
            />
          </div>

          {/* Notification bell */}
          <div className="relative">
            <button
              onClick={toggle}
              className="relative flex items-center justify-center w-9 h-9 rounded-md border border-white/[0.07] text-muted-foreground hover:text-foreground hover:bg-surface-3 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <NotificationPanel />
          </div>

          <button
            onClick={() => setCaptureOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            Capturar
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/[0.07] text-sm text-muted-foreground hover:text-foreground hover:bg-surface-3 transition-colors">
            <ListTodo className="w-3.5 h-3.5" />
            Nova Tarefa
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/[0.07] text-sm text-muted-foreground hover:text-foreground hover:bg-surface-3 transition-colors">
            <Video className="w-3.5 h-3.5" />
            Reunião
          </button>
        </div>
      </header>
      {captureOpen && <QuickCaptureModal onClose={() => setCaptureOpen(false)} />}
    </>
  );
}
