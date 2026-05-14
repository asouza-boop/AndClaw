import { Search, Plus, ListTodo, Video, Bell, Menu } from 'lucide-react';
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
      <header
        className="flex items-center justify-between shrink-0 sticky top-0 z-[50]"
        style={{
          height: '56px',
          padding: '0 24px',
          borderBottom: '1px solid rgba(99, 102, 241, 0.1)',
          backgroundColor: 'rgba(10, 12, 30, 0.7)',
          backdropFilter: 'blur(20px) saturate(150%)',
          WebkitBackdropFilter: 'blur(20px) saturate(150%)',
        }}
      >
        <div className="flex items-center gap-4">
          {/* Mobile hamburger — shows sidebar drawer (future) */}
          <button
            className="md:hidden p-2 rounded-lg"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          <h1
            style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h1>

          {/* Search — desktop only */}
          <div className="relative hidden lg:block group" style={{ marginLeft: '8px' }}>
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
            />
            <input
              type="text"
              placeholder="Search or jump to..."
              style={{
                paddingLeft: '32px',
                paddingRight: '48px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-primary)',
                width: '240px',
                outline: 'none',
                transition: 'border-color var(--t-fast)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent-dim)'; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
            />
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                fontSize: '10px',
                color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              ⌘K
            </span>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Notification bell */}
          <div className="relative">
            <button
              id="notifications-button"
              onClick={toggle}
              className="relative flex items-center justify-center rounded-lg transition-colors"
              style={{
                width: '36px',
                height: '36px',
                border: '1px solid var(--color-border)',
                backgroundColor: unreadCount > 0 ? 'var(--color-accent-sub)' : 'transparent',
                color: unreadCount > 0 ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              }}
              onMouseEnter={(e) => {
                if (unreadCount === 0) {
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (unreadCount === 0) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }
              }}
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 flex items-center justify-center rounded-full"
                  style={{
                    minWidth: '16px',
                    height: '16px',
                    backgroundColor: 'var(--color-accent)',
                    color: '#ffffff',
                    fontSize: '9px',
                    fontWeight: 600,
                    padding: '0 3px',
                  }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <NotificationPanel />
          </div>

          {/* Divider */}
          <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--color-border)' }} />

          {/* Capture button */}
          <button
            onClick={() => openQuickCapture('note')}
            className="flex items-center gap-2 transition-colors"
            style={{
              height: '36px',
              padding: '0 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-accent)',
              color: '#ffffff',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-accent)'; }}
          >
            <Plus size={14} />
            <span>Capture</span>
          </button>

          {/* Secondary actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => openQuickCapture('task')}
              className="flex items-center justify-center rounded-lg transition-colors"
              style={{
                width: '36px',
                height: '36px',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                backgroundColor: 'transparent',
              }}
              title="Nova Tarefa"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
            >
              <ListTodo size={16} />
            </button>
            <button
              className="flex items-center justify-center rounded-lg transition-colors"
              style={{
                width: '36px',
                height: '36px',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                backgroundColor: 'transparent',
              }}
              title="Reunião"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
            >
              <Video size={16} />
            </button>
          </div>
        </div>
      </header>
      <QuickCaptureModal />
    </>
  );
}
