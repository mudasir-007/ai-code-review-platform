import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';

/* ─────────────────────────────────────────────────────────────
   Inline SVG Icons
───────────────────────────────────────────────────────────── */
function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
function GitHubIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.28-.01-1.03-.02-2.02-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.85 1.24 1.85 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.21.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   3D Floating Shapes (CSS-only, no canvas needed)
───────────────────────────────────────────────────────────── */
function FloatingShapes() {
  return (
    <div className="relative w-full h-full flex items-center justify-center" aria-hidden="true">
      <style>{`
        @keyframes float1 { 0%,100%{transform:translateY(0px) rotate(0deg)} 50%{transform:translateY(-22px) rotate(8deg)} }
        @keyframes float2 { 0%,100%{transform:translateY(0px) rotate(0deg)} 50%{transform:translateY(-16px) rotate(-10deg)} }
        @keyframes float3 { 0%,100%{transform:translateY(0px) rotate(0deg)} 50%{transform:translateY(-28px) rotate(12deg)} }
        @keyframes float4 { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-18px)} }
        @keyframes float5 { 0%,100%{transform:translateY(0px) rotate(0deg)} 50%{transform:translateY(-12px) rotate(-8deg)} }
        @keyframes glow   { 0%,100%{opacity:0.55} 50%{opacity:1} }
        .shape-float1 { animation: float1 6s ease-in-out infinite; }
        .shape-float2 { animation: float2 7.5s ease-in-out infinite 1s; }
        .shape-float3 { animation: float3 5.5s ease-in-out infinite 0.5s; }
        .shape-float4 { animation: float4 8s ease-in-out infinite 1.5s; }
        .shape-float5 { animation: float5 6.5s ease-in-out infinite 2s; }
        .glow-pulse   { animation: glow 3s ease-in-out infinite; }
      `}</style>

      {/* Central purple glow bloom */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="glow-pulse" style={{
          width: 340, height: 340,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(120,80,220,0.35) 0%, rgba(90,50,180,0.15) 50%, transparent 75%)',
          filter: 'blur(32px)',
        }} />
      </div>

      {/* Large torus ring — top right */}
      <div className="shape-float2 absolute" style={{ top: '12%', right: '15%' }}>
        <svg width="130" height="130" viewBox="0 0 130 130">
          <defs>
            <radialGradient id="ring1g" cx="50%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#9575CD" />
              <stop offset="100%" stopColor="#311B92" />
            </radialGradient>
          </defs>
          <ellipse cx="65" cy="65" rx="55" ry="55" fill="none" stroke="url(#ring1g)" strokeWidth="22" />
          <ellipse cx="65" cy="65" rx="55" ry="55" fill="none" stroke="rgba(150,100,255,0.15)" strokeWidth="24" />
        </svg>
      </div>

      {/* Medium torus ring — bottom left */}
      <div className="shape-float3 absolute" style={{ bottom: '18%', left: '8%' }}>
        <svg width="95" height="95" viewBox="0 0 95 95">
          <defs>
            <radialGradient id="ring2g" cx="50%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#7E57C2" />
              <stop offset="100%" stopColor="#1A0A5C" />
            </radialGradient>
          </defs>
          <ellipse cx="47" cy="47" rx="38" ry="38" fill="none" stroke="url(#ring2g)" strokeWidth="16" />
        </svg>
      </div>

      {/* Large cube — center-left */}
      <div className="shape-float1 absolute" style={{ top: '28%', left: '12%' }}>
        <svg width="110" height="110" viewBox="0 0 110 110">
          <defs>
            <linearGradient id="cube1top" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4A3080" />
              <stop offset="100%" stopColor="#2A1A5E" />
            </linearGradient>
            <linearGradient id="cube1left" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1E1050" />
              <stop offset="100%" stopColor="#2A1A5E" />
            </linearGradient>
            <linearGradient id="cube1right" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3A2070" />
              <stop offset="100%" stopColor="#251560" />
            </linearGradient>
          </defs>
          {/* top face */}
          <polygon points="55,10 100,32 55,54 10,32" fill="url(#cube1top)" />
          {/* left face */}
          <polygon points="10,32 55,54 55,100 10,78" fill="url(#cube1left)" />
          {/* right face */}
          <polygon points="55,54 100,32 100,78 55,100" fill="url(#cube1right)" />
          {/* edges */}
          <polygon points="55,10 100,32 55,54 10,32" fill="none" stroke="rgba(150,100,255,0.25)" strokeWidth="1" />
          <polygon points="10,32 55,54 55,100 10,78" fill="none" stroke="rgba(120,80,220,0.2)" strokeWidth="1" />
          <polygon points="55,54 100,32 100,78 55,100" fill="none" stroke="rgba(120,80,220,0.2)" strokeWidth="1" />
        </svg>
      </div>

      {/* Small cube — top left */}
      <div className="shape-float5 absolute" style={{ top: '8%', left: '28%' }}>
        <svg width="52" height="52" viewBox="0 0 52 52">
          <polygon points="26,5 47,16 26,27 5,16" fill="#2A1A60" />
          <polygon points="5,16 26,27 26,47 5,36" fill="#1A0E45" />
          <polygon points="26,27 47,16 47,36 26,47" fill="#221550" />
          <polygon points="26,5 47,16 26,27 5,16" fill="none" stroke="rgba(140,90,255,0.3)" strokeWidth="1" />
        </svg>
      </div>

      {/* Small cube — bottom right */}
      <div className="shape-float4 absolute" style={{ bottom: '12%', right: '10%' }}>
        <svg width="44" height="44" viewBox="0 0 44 44">
          <polygon points="22,4 40,13 22,22 4,13" fill="#331A70" />
          <polygon points="4,13 22,22 22,40 4,31" fill="#1E0E50" />
          <polygon points="22,22 40,13 40,31 22,40" fill="#2A1660" />
        </svg>
      </div>

      {/* Large sphere — bottom center */}
      <div className="shape-float4 absolute" style={{ bottom: '8%', left: '35%' }}>
        <svg width="90" height="90" viewBox="0 0 90 90">
          <defs>
            <radialGradient id="sph1" cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#5C3DB5" />
              <stop offset="60%" stopColor="#2A1880" />
              <stop offset="100%" stopColor="#0D0828" />
            </radialGradient>
          </defs>
          <circle cx="45" cy="45" r="42" fill="url(#sph1)" />
          <circle cx="45" cy="45" r="42" fill="none" stroke="rgba(130,90,230,0.2)" strokeWidth="1" />
        </svg>
      </div>

      {/* Small sphere top */}
      <div className="shape-float2 absolute" style={{ top: '22%', right: '30%' }}>
        <svg width="36" height="36" viewBox="0 0 36 36">
          <defs>
            <radialGradient id="sph2" cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#7C50D0" />
              <stop offset="100%" stopColor="#1A0A50" />
            </radialGradient>
          </defs>
          <circle cx="18" cy="18" r="16" fill="url(#sph2)" />
        </svg>
      </div>

      {/* Tiny sphere */}
      <div className="shape-float3 absolute" style={{ top: '55%', left: '5%' }}>
        <svg width="22" height="22" viewBox="0 0 22 22">
          <defs>
            <radialGradient id="sph3" cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#6040C0" />
              <stop offset="100%" stopColor="#160A40" />
            </radialGradient>
          </defs>
          <circle cx="11" cy="11" r="10" fill="url(#sph3)" />
        </svg>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Input Field
───────────────────────────────────────────────────────────── */
function Field({ id, label, type = 'text', value, onChange, placeholder, autoComplete, showToggle, visible, onToggle, error }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} style={{ color: '#A0A8C0', fontSize: 13, fontWeight: 500, display: 'block' }}>
        {label}
      </label>
      <div style={{
        display: 'flex', alignItems: 'center',
        background: '#0E1220',
        border: `1.5px solid ${error ? '#FF6B5E' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 12,
        padding: '0 16px',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
        className="focus-within-ring"
      >
        <input
          id={id}
          type={showToggle ? (visible ? 'text' : 'password') : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#E8EAFF', fontSize: 14, padding: '14px 0',
            fontFamily: 'Inter, sans-serif',
          }}
        />
        {showToggle && (
          <button type="button" onClick={onToggle} tabIndex={-1}
            style={{ color: '#5A6080', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
            aria-label={visible ? 'Hide password' : 'Show password'}>
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {error && <p style={{ color: '#FF6B5E', fontSize: 12, margin: '4px 0 0', fontFamily: 'monospace' }}>{error}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main AuthPage
───────────────────────────────────────────────────────────── */
export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const isLogin = mode === 'login';

  function validate() {
    const e = {};
    if (!isLogin && !name.trim()) e.name = 'Name is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (!isLogin && password.length < 8) e.password = 'Minimum 8 characters';
    return e;
  }
  const errors = touched ? validate() : {};

  function switchMode(m) {
    setMode(m);
    setServerError('');
    setTouched(false);
    setName(''); setEmail(''); setPassword('');
    setShowPassword(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(validate()).length > 0) return;
    setLoading(true);
    setServerError('');
    try {
      if (isLogin) await login(email, password);
      else await register(name, email, password);
    } catch (err) {
      setServerError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  /* Styles */
  const PAGE_BG      = '#080B18';
  const LEFT_BG      = '#080B18';
  const RIGHT_BG     = '#0D1020';
  const CARD_BG      = '#111425';
  const ACCENT       = '#7C5CFC';
  const ACCENT2      = '#A78BFA';
  const TEXT_MAIN    = '#E8EAFF';
  const TEXT_MUTED   = '#6B7280';
  const BORDER_COLOR = 'rgba(255,255,255,0.07)';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: PAGE_BG, fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        .auth-input-wrap:focus-within { border-color: rgba(124,92,252,0.6) !important; box-shadow: 0 0 0 3px rgba(124,92,252,0.12); }
        .auth-social-btn:hover { border-color: rgba(124,92,252,0.4) !important; background: rgba(124,92,252,0.06) !important; color: #E8EAFF !important; }
        .auth-submit-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 8px 32px rgba(124,92,252,0.45) !important; }
        .auth-submit-btn:active:not(:disabled) { transform: translateY(0); }
        .auth-submit-btn { transition: all 0.2s ease; }
        .auth-link:hover { color: ${ACCENT2} !important; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.45s ease both; }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      `}</style>

      {/* ══════════ LEFT PANEL ══════════ */}
      <div style={{
        width: '55%', background: LEFT_BG, position: 'relative',
        display: 'flex', flexDirection: 'column',
        padding: '52px 64px', overflow: 'hidden',
        borderRight: `1px solid ${BORDER_COLOR}`,
      }} className="hidden lg:flex">

        {/* Top-left logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'auto' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #7C5CFC, #A78BFA)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <span style={{ color: TEXT_MAIN, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>AI Code Review</span>
        </div>

        {/* Shapes in the middle */}
        <div style={{ position: 'absolute', inset: '80px 0 160px 0', pointerEvents: 'none' }}>
          <FloatingShapes />
        </div>

        {/* Bottom text block */}
        <div style={{ marginTop: 'auto', position: 'relative', zIndex: 10 }}>
          <h1 style={{
            fontSize: 52, fontWeight: 800, lineHeight: 1.1,
            color: TEXT_MAIN, margin: '0 0 14px',
            letterSpacing: '-0.03em',
          }}>
            {isLogin ? 'Welcome\nBack' : 'Get\nStarted'}
          </h1>
          <p style={{ color: '#5A6480', fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>
            {isLogin
              ? 'Sign in to your account to continue reviewing\nyour GitHub repositories with AI.'
              : 'Create your free account and start getting\nAI-powered code reviews in seconds.'}
          </p>

          {/* Feature dots */}
          <div style={{ display: 'flex', gap: 28 }}>
            {[
              { label: 'Secure', color: '#7C5CFC' },
              { label: 'Fast',   color: '#A78BFA' },
              { label: 'Reliable', color: '#C4B5FD' },
            ].map(({ label, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ color: '#8A90B0', fontSize: 13, fontWeight: 500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════ RIGHT PANEL ══════════ */}
      <div style={{
        flex: 1, background: RIGHT_BG,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <div className="fade-up" style={{ width: '100%', maxWidth: 420 }}>

          {/* Mobile logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }} className="lg:hidden">
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg,#7C5CFC,#A78BFA)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            <span style={{ color: TEXT_MAIN, fontSize: 15, fontWeight: 600 }}>AI Code Review</span>
          </div>

          {/* Card */}
          <div style={{
            background: CARD_BG,
            borderRadius: 20,
            border: `1px solid ${BORDER_COLOR}`,
            padding: '36px 36px 32px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
          }}>
            {/* Heading */}
            <h2 style={{ color: TEXT_MAIN, fontSize: 26, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
              {isLogin ? 'Log In' : 'Create Account'}
            </h2>
            <p style={{ color: TEXT_MUTED, fontSize: 13, margin: '0 0 28px' }}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button type="button" onClick={() => switchMode(isLogin ? 'register' : 'login')}
                className="auth-link"
                style={{ color: ACCENT2, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, fontFamily: 'inherit' }}>
                {isLogin ? 'Sign Up' : 'Log In'}
              </button>
            </p>

            <form id="auth-form" onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Name — register only */}
              {!isLogin && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label htmlFor="auth-name" style={{ color: '#A0A8C0', fontSize: 13, fontWeight: 500 }}>Full Name</label>
                  <div className="auth-input-wrap" style={{
                    display: 'flex', alignItems: 'center',
                    background: '#0E1220', border: `1.5px solid ${errors.name ? '#FF6B5E' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 12, padding: '0 16px',
                  }}>
                    <input id="auth-name" type="text" value={name} onChange={e => setName(e.target.value)}
                      placeholder="Ada Lovelace" autoComplete="name"
                      style={{ flex:1, background:'transparent', border:'none', outline:'none', color: TEXT_MAIN, fontSize:14, padding:'14px 0', fontFamily:'inherit' }} />
                  </div>
                  {errors.name && <p style={{ color:'#FF6B5E', fontSize:12, margin:0, fontFamily:'monospace' }}>{errors.name}</p>}
                </div>
              )}

              {/* Email */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label htmlFor="auth-email" style={{ color: '#A0A8C0', fontSize: 13, fontWeight: 500 }}>Email Address</label>
                <div className="auth-input-wrap" style={{
                  display: 'flex', alignItems: 'center',
                  background: '#0E1220', border: `1.5px solid ${errors.email ? '#FF6B5E' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 12, padding: '0 16px',
                }}>
                  <input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="ada@example.com" autoComplete={isLogin ? 'username' : 'email'}
                    style={{ flex:1, background:'transparent', border:'none', outline:'none', color: TEXT_MAIN, fontSize:14, padding:'14px 0', fontFamily:'inherit' }} />
                </div>
                {errors.email && <p style={{ color:'#FF6B5E', fontSize:12, margin:0, fontFamily:'monospace' }}>{errors.email}</p>}
              </div>

              {/* Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <label htmlFor="auth-password" style={{ color: '#A0A8C0', fontSize: 13, fontWeight: 500 }}>Password</label>
                  {isLogin && (
                    <button type="button" className="auth-link"
                      style={{ color: ACCENT2, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, padding: 0, fontFamily: 'inherit' }}>
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="auth-input-wrap" style={{
                  display: 'flex', alignItems: 'center',
                  background: '#0E1220', border: `1.5px solid ${errors.password ? '#FF6B5E' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 12, padding: '0 16px',
                }}>
                  <input id="auth-password" type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    style={{ flex:1, background:'transparent', border:'none', outline:'none', color: TEXT_MAIN, fontSize:14, padding:'14px 0', fontFamily:'inherit' }} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                    style={{ color:'#5A6080', background:'none', border:'none', cursor:'pointer', padding:0, lineHeight:0 }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {errors.password && <p style={{ color:'#FF6B5E', fontSize:12, margin:0, fontFamily:'monospace' }}>{errors.password}</p>}
              </div>

              {/* Server error banner */}
              {serverError && (
                <div role="alert" style={{
                  display:'flex', alignItems:'flex-start', gap:10,
                  background:'rgba(255,107,94,0.08)', border:'1px solid rgba(255,107,94,0.25)',
                  borderRadius:10, padding:'12px 14px',
                }}>
                  <span style={{ color:'#FF6B5E', fontSize:14, marginTop:1 }}>⚠</span>
                  <p style={{ color:'#FF6B5E', fontSize:13, margin:0 }}>{serverError}</p>
                </div>
              )}

              {/* Submit button */}
              <button id="auth-submit" type="submit" disabled={loading}
                className="auth-submit-btn"
                style={{
                  width: '100%', border: 'none', borderRadius: 12,
                  padding: '15px 0', fontSize: 15, fontWeight: 700,
                  color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                  background: loading
                    ? 'rgba(124,92,252,0.4)'
                    : 'linear-gradient(135deg, #7C5CFC 0%, #9B7CFF 100%)',
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(124,92,252,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  fontFamily: 'inherit', opacity: loading ? 0.7 : 1,
                  marginTop: 4,
                }}>
                {loading ? <><SpinnerIcon />{isLogin ? 'Signing in…' : 'Creating account…'}</> : isLogin ? 'Log In' : 'Create Account'}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display:'flex', alignItems:'center', gap:14, margin:'24px 0' }}>
              <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.06)' }} />
              <span style={{ color: TEXT_MUTED, fontSize: 12, whiteSpace: 'nowrap' }}>or continue with</span>
              <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.06)' }} />
            </div>

            {/* Social buttons */}
            <div style={{ display:'flex', gap:12 }}>
              {[
                { id:'google-btn', icon:<GoogleIcon />, label:'Google' },
                { id:'github-btn', icon:<GitHubIcon />, label:'GitHub' },
              ].map(({ id, icon, label }) => (
                <button key={id} type="button" id={id}
                  className="auth-social-btn"
                  style={{
                    flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:9,
                    background:'rgba(255,255,255,0.03)', border:'1.5px solid rgba(255,255,255,0.08)',
                    borderRadius:12, padding:'12px 0', fontSize:13, fontWeight:600,
                    color:'#8A90B0', cursor:'pointer', fontFamily:'inherit', transition:'all 0.2s',
                  }}>
                  {icon}{label}
                </button>
              ))}
            </div>
          </div>

          {/* Terms */}
          <p style={{ textAlign:'center', color:'#3A4060', fontSize:12, marginTop:20, lineHeight:1.6 }}>
            By signing in, you agree to our{' '}
            <span className="auth-link" style={{ color:'#5A6480', cursor:'pointer' }}>Terms of Service</span>
            {' & '}
            <span className="auth-link" style={{ color:'#5A6480', cursor:'pointer' }}>Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}
