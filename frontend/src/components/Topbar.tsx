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
      <header className="h-20 flex items-center justify-between px-10 border-b border-white/[0.05] bg-[#050507]/40 backdrop-blur-xl shrink-0 sticky top-0 z-[50]">
        <div className="flex items-center gap-6">
          <h1 className="text-h2 text-white tracking-tighter transition-premium">
            {title}
          </h1>
          <div className="h-5 w-[1px] bg-white/10 hidden md:block" />
          <div className="relative hidden lg:block group">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search or jump to..."
              className="pl-11 pr-14 py-2.5 rounded-2xl bg-white/[0.03] border border-white/5 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 focus:bg-white/[0.05] w-72 transition-premium"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-black text-white/30 tracking-widest pointer-events-none">
              ⌘K
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Notification bell */}
          <div className="relative">
            <button
              id="notifications-button"
              onClick={toggle}
              className={`relative flex items-center justify-center w-11 h-11 rounded-2xl border transition-premium interactive-scale ${
                unreadCount > 0 
                  ? 'border-primary/30 bg-primary/5 text-primary shadow-lg shadow-primary/20' 
                  : 'border-white/[0.07] text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              <Bell className="w-4.5 h-4.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] flex items-center justify-center rounded-full bg-primary text-white text-[10px] font-black border-2 border-[#050507] animate-in zoom-in">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <NotificationPanel />
          </div>

          <div className="h-6 w-[1px] bg-white/10 mx-2" />

          <button
            onClick={() => openQuickCapture('note')}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-black text-[11px] font-black uppercase tracking-widest shadow-xl shadow-white/5 hover:bg-primary hover:text-white transition-premium interactive-scale"
          >
            <Plus className="w-4 h-4" />
            <span>Capture</span>
          </button>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => openQuickCapture('task')}
              className="p-3 rounded-2xl border border-white/[0.07] text-white/40 hover:text-white hover:bg-white/5 hover:border-white/20 transition-premium group interactive-scale"
              title="New Operation"
            >
              <ListTodo className="w-4.5 h-4.5 group-hover:scale-110 transition-premium" />
            </button>
            <button 
              className="p-3 rounded-2xl border border-white/[0.07] text-white/40 hover:text-white hover:bg-white/5 hover:border-white/20 transition-premium group interactive-scale"
              title="Protocol Meeting"
            >
              <Video className="w-4.5 h-4.5 group-hover:scale-110 transition-premium" />
            </button>
          </div>
        </div>
      </header>
      <QuickCaptureModal />
    </>
  );
}
