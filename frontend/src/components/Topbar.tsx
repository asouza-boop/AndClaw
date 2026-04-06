import { Search, Plus, ListTodo, Video, Bell } from 'lucide-react';
import { useState } from 'react';
import { QuickCaptureModal } from './QuickCaptureModal';
import { NotificationPanel } from './NotificationPanel';
import { useNotificationStore } from '@/stores/notificationStore';
import { useQuickCaptureStore } from '@/stores/quickCaptureStore';

interface TopbarProps {
  title: string;
}

export function Topbar({ title }: TopbarProps) {
  const { unreadCount, toggle } = useNotificationStore();
  const { open: openQuickCapture } = useQuickCaptureStore();

  return (
    <>
      <header className="h-16 flex items-center justify-between px-8 border-b border-white/[0.08] bg-surface/40 backdrop-blur-md shrink-0 sticky top-0 z-[50]">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight text-foreground transition-all duration-300">
            {title}
          </h1>
          <div className="h-4 w-[1px] bg-white/10 hidden md:block" />
          <div className="relative hidden lg:block group">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Buscar comandos, notas..."
              className="pl-9 pr-4 py-1.5 rounded-lg bg-surface-2 border border-white/[0.05] text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 w-64 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Notification bell */}
          <div className="relative">
            <button
              id="notifications-button"
              onClick={toggle}
              className={`relative flex items-center justify-center w-10 h-10 rounded-xl border transition-all duration-200 ${
                unreadCount > 0 
                  ? 'border-primary/30 bg-primary/5 text-primary shadow-lg shadow-primary/10' 
                  : 'border-white/[0.07] text-muted-foreground hover:text-foreground hover:bg-surface-3'
              }`}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] flex items-center justify-center rounded-full bg-primary text-white text-[10px] font-black border-2 border-surface animate-in zoom-in">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <NotificationPanel />
          </div>

          <div className="h-6 w-[1px] bg-white/10 mx-1" />

          <button
            onClick={() => openQuickCapture('note')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Capturar</span>
          </button>
          
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => openQuickCapture('task')}
              className="p-2.5 rounded-xl border border-white/[0.07] text-muted-foreground hover:text-foreground hover:bg-surface-3 hover:border-white/20 transition-all group"
              title="Nova Tarefa"
            >
              <ListTodo className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
            <button 
              className="p-2.5 rounded-xl border border-white/[0.07] text-muted-foreground hover:text-foreground hover:bg-surface-3 hover:border-white/20 transition-all group"
              title="Nova Reunião"
            >
              <Video className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      </header>
      <QuickCaptureModal />
    </>
  );
}
