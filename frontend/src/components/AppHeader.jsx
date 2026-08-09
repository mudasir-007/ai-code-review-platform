import { useAuth } from '../contexts/AuthContext.jsx';

export default function AppHeader() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const initials = user.name
    ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : user.email[0].toUpperCase();

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 h-14 flex items-center justify-between px-6
        border-b border-white/8"
      style={{
        background: 'rgba(13,11,20,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Wordmark */}
      <div className="flex items-center gap-2.5">
        <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulseDot" />
        <span className="font-mono text-xs tracking-widest text-signal uppercase select-none">
          AI Code Review
        </span>
      </div>

      {/* Right: avatar + name + sign out */}
      <div className="flex items-center gap-3">
        <span className="hidden sm:block text-sm text-textMuted max-w-[14rem] truncate font-body">
          {user.name || user.email}
        </span>

        {/* Avatar */}
        <div
          aria-hidden="true"
          className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white select-none"
          style={{ background: 'linear-gradient(135deg,#A996FF,#c4a8ff)' }}
        >
          {initials}
        </div>

        <button
          id="sign-out-btn"
          type="button"
          onClick={logout}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-body text-textMuted
            hover:border-signal/40 hover:text-text hover:bg-signal/5 transition-all duration-200"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
