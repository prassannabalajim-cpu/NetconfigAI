// @ts-nocheck
import { useState } from 'react';
import { Box, Button, Typography, Paper, Grid, TextField, CircularProgress, MenuItem } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import SecurityIcon from '@mui/icons-material/Security';
import ShieldIcon from '@mui/icons-material/Shield';
import SpeedIcon from '@mui/icons-material/Speed';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockIcon from '@mui/icons-material/Lock';
import { toast } from 'react-toastify';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

interface AuthPageProps {
  onLogin: (authData: any) => void;
}

const FeatureItem = ({ icon, text }: { icon: any, text: string }): any => (
  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
    <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', marginRight: '16px', display: 'flex' }}>
      {icon}
    </div>
    <Typography variant="h6" sx={{ color: 'white', fontWeight: 500 }}>{text}</Typography>
  </div>
);

function AuthForm({ onLogin }: AuthPageProps) {
  const [view, setView] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'network_engineer' | 'manager'>('network_engineer');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (view === 'login') {
        const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        if (!res.ok) throw new Error('Invalid email or password');
        const data = await res.json();
        toast.success('✅ Logged in successfully!');
        onLogin(data);
      } else if (view === 'signup') {
        const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, full_name: fullName, role })
        });
        if (!res.ok) throw new Error('Registration failed. Email may already exist.');
        toast.success('✅ Account created! Please log in.');
        const loginRes = await fetch(`${API_BASE}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        if (!loginRes.ok) throw new Error('Account created, but automatic sign-in failed. Please log in.');
        const data = await loginRes.json();
        onLogin(data);
      } else {
        await fetch(`${API_BASE}/api/v1/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        toast.info('If an account exists, a reset link has been sent.');
        setView('login');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Only available when wrapped in GoogleOAuthProvider (i.e., GOOGLE_CLIENT_ID set)
  const googleLogin = GOOGLE_CLIENT_ID ? useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/v1/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: tokenResponse.access_token })
        });
        if (!res.ok) throw new Error('Google authentication failed');
        const data = await res.json();
        toast.success('✅ Signed in with Google!');
        onLogin(data);
      } catch (err: any) {
        toast.error(err.message || 'Google sign-in failed');
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => toast.error('Google sign-in cancelled'),
  }) : null;

  const startGoogleRedirectLogin = () => {
    setGoogleLoading(true);
    window.location.href = `${API_BASE}/auth/google/login`;
  };

  const inputSx = { input: { color: 'white' }, label: { color: '#94A3B8' }, fieldset: { borderColor: 'rgba(255,255,255,0.15)' } };

  return (
    <Grid container sx={{ minHeight: '100vh', bgcolor: '#0B0F19' }}>
      {/* Left Side */}
      <Grid item xs={12} md={6} sx={{
        display: { xs: 'none', md: 'flex' }, flexDirection: 'column', justifyContent: 'center',
        p: 8, background: 'linear-gradient(135deg, #0B0F19 0%, #1A233A 100%)', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%' }} />
        <Box sx={{ zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 6 }}>
            <SecurityIcon sx={{ color: '#3B82F6', fontSize: 48, mr: 2 }} />
            <Typography variant="h3" sx={{ color: 'white', fontWeight: 700 }}>
              NetConfig<span style={{ color: '#3B82F6' }}>AI</span>
            </Typography>
          </Box>
          <Typography variant="h4" sx={{ color: '#E2E8F0', mb: 2, fontWeight: 600 }}>Enterprise Network Configuration Review</Typography>
          <Typography variant="h6" sx={{ color: '#94A3B8', mb: 8, fontWeight: 400, maxWidth: '80%' }}>
            Automate compliance, detect security risks, and accelerate your infrastructure deployments with AI-powered differential analysis.
          </Typography>
          <FeatureItem icon={<ShieldIcon sx={{ color: '#10B981' }}/>} text="Automated Security & Compliance Analysis" />
          <FeatureItem icon={<SpeedIcon sx={{ color: '#F59E0B' }}/>} text="Accelerated Review Workflows" />
          <FeatureItem icon={<CheckCircleIcon sx={{ color: '#3B82F6' }}/>} text="Enterprise RBAC & Audit Trails" />
        </Box>
      </Grid>

      {/* Right Side */}
      <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4, position: 'relative' }}>
        <Box sx={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%' }} />

        <Paper elevation={24} sx={{ p: 6, width: '100%', maxWidth: 480, bgcolor: 'rgba(30,41,59,0.85)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', zIndex: 1 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: '16px', bgcolor: 'rgba(59,130,246,0.15)', mb: 2 }}>
              <LockIcon sx={{ color: '#3B82F6', fontSize: 28 }} />
            </Box>
            <Typography variant="h4" sx={{ color: 'white', fontWeight: 800, mb: 0.5 }}>
              {view === 'login' ? 'Welcome Back' : view === 'signup' ? 'Create Account' : 'Reset Password'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B' }}>
              {view === 'login' ? 'Sign in to your enterprise dashboard' : view === 'signup' ? 'Register to get started' : 'Enter your email for a reset link'}
            </Typography>
          </Box>

          {/* Google OAuth — only when configured */}
          {view === 'login' && (
            <>
              <Button
                fullWidth variant="contained" size="large"
                startIcon={googleLoading ? <CircularProgress size={18} color="inherit" /> : <GoogleIcon />}
                disabled={googleLoading}
                onClick={startGoogleRedirectLogin}
                sx={{ py: 1.5, bgcolor: 'white', color: '#1E293B', fontWeight: 700, borderRadius: '12px', mb: 3, fontSize: '0.9rem', '&:hover': { bgcolor: '#F1F5F9' } }}
              >
                {googleLoading ? 'Signing in...' : 'Continue with Google'}
              </Button>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255,255,255,0.1)' }} />
                <Typography sx={{ color: '#475569', px: 2, fontSize: '0.8rem', fontWeight: 600 }}>OR</Typography>
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255,255,255,0.1)' }} />
              </Box>
            </>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {view === 'signup' && (
              <>
                <TextField label="Full Name" variant="outlined" fullWidth required value={fullName}
                  onChange={e => setFullName(e.target.value)} sx={inputSx} />
                <TextField
                  select
                  label="Account Role"
                  variant="outlined"
                  fullWidth
                  required
                  value={role}
                  onChange={e => setRole(e.target.value as 'network_engineer' | 'manager')}
                  sx={{
                    ...inputSx,
                    '& .MuiSelect-select': { color: 'white' },
                    '& .MuiSvgIcon-root': { color: '#94A3B8' }
                  }}
                >
                  <MenuItem value="network_engineer">Network Engineer</MenuItem>
                  <MenuItem value="manager">Manager</MenuItem>
                </TextField>
              </>
            )}
            <TextField label="Email Address" type="email" variant="outlined" fullWidth required value={email}
              onChange={e => setEmail(e.target.value)} sx={inputSx} />
            {view !== 'forgot' && (
              <TextField label="Password" type="password" variant="outlined" fullWidth required value={password}
                onChange={e => setPassword(e.target.value)} sx={inputSx} />
            )}
            {view === 'login' && (
              <Typography variant="body2" align="right" sx={{ color: '#3B82F6', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }} onClick={() => setView('forgot')}>
                Forgot Password?
              </Typography>
            )}
            <Button type="submit" fullWidth variant="contained" size="large" disabled={loading}
              sx={{ py: 1.5, mt: 1, bgcolor: '#3B82F6', fontWeight: 700, borderRadius: '12px', fontSize: '0.95rem', boxShadow: '0 4px 20px rgba(59,130,246,0.35)', '&:hover': { bgcolor: '#2563EB' } }}>
              {loading ? <CircularProgress size={24} color="inherit" /> :
               view === 'login' ? 'Sign In →' : view === 'signup' ? 'Create Account →' : 'Send Reset Link'}
            </Button>
          </form>

          {/* Google placeholder when not configured */}
          {false && !GOOGLE_CLIENT_ID && view === 'login' && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', my: 3 }}>
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255,255,255,0.08)' }} />
                <Typography sx={{ color: '#475569', px: 2, fontSize: '0.8rem' }}>OR</Typography>
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255,255,255,0.08)' }} />
              </Box>
              <Button fullWidth variant="outlined" size="large" startIcon={<GoogleIcon />} disabled
                sx={{ py: 1.5, borderColor: 'rgba(255,255,255,0.12)', color: '#334155', borderRadius: '12px', fontWeight: 600 }}>
                Google OAuth (Set VITE_GOOGLE_CLIENT_ID)
              </Button>
            </>
          )}

          {/* Toggle */}
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            {view === 'login' ? (
              <Typography sx={{ color: '#64748B', fontSize: '0.875rem' }}>
                Don't have an account?{' '}
                <span onClick={() => setView('signup')} style={{ color: '#3B82F6', cursor: 'pointer', fontWeight: 700 }}>Sign up free</span>
              </Typography>
            ) : (
              <Typography sx={{ color: '#64748B', fontSize: '0.875rem' }}>
                Already have an account?{' '}
                <span onClick={() => setView('login')} style={{ color: '#3B82F6', cursor: 'pointer', fontWeight: 700 }}>Sign in</span>
              </Typography>
            )}
          </Box>

          <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <LockIcon sx={{ color: '#1E293B', fontSize: 13 }} />
            <Typography sx={{ color: '#1E293B', fontSize: '0.72rem' }}>
              JWT Secured · Enterprise Auth · TLS Encrypted
            </Typography>
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );
}

const AuthPage = ({ onLogin }: AuthPageProps) => {
  if (GOOGLE_CLIENT_ID) {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <AuthForm onLogin={onLogin} />
      </GoogleOAuthProvider>
    );
  }
  return <AuthForm onLogin={onLogin} />;
};

export default AuthPage;
