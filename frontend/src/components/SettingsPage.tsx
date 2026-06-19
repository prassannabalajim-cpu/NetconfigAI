// @ts-nocheck
import { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import LockResetIcon from '@mui/icons-material/LockReset';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PsychologyIcon from '@mui/icons-material/Psychology';
import axios from 'axios';
import { toast } from 'react-toastify';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const labelForPreference: Record<string, string> = {
  email_notifications: 'Email notifications',
  approval_notifications: 'Approval workflow notifications',
  analysis_notifications: 'Analysis completion notifications',
  compact_dashboard: 'Compact dashboard cards',
  remember_session: 'Remember this device',
};

export default function SettingsPage({ user, onUserUpdate }: any) {
  const [loading, setLoading] = useState(true);
  const [profileImage, setProfileImage] = useState('');
  const [preferences, setPreferences] = useState<any>({});
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/auth/account/settings`);
      setProfileImage(res.data.profile_image || '');
      setPreferences(res.data.preferences || {});
      if (res.data.user) onUserUpdate?.(res.data.user);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to load account settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleImageChange = async (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      toast.error('Profile image must be under 2 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const image = String(reader.result);
        const res = await axios.patch(`${API_BASE}/api/v1/auth/account/profile-photo`, { profile_image: image });
        setProfileImage(res.data.profile_image || '');
        toast.success('Profile photo updated');
      } catch (error: any) {
        toast.error(error.response?.data?.detail || 'Failed to update profile photo');
      }
    };
    reader.readAsDataURL(file);
  };

  const savePreferences = async () => {
    setSavingPrefs(true);
    try {
      const res = await axios.patch(`${API_BASE}/api/v1/auth/account/preferences`, { preferences });
      setPreferences(res.data.preferences || {});
      toast.success('Settings saved');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSavingPrefs(false);
    }
  };

  const changePassword = async () => {
    if (!passwords.current_password || !passwords.new_password) {
      toast.error('Enter current and new password');
      return;
    }
    if (passwords.new_password !== passwords.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      await axios.post(`${API_BASE}/api/v1/auth/change-password`, {
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      });
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
      toast.success('Password changed successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 6, textAlign: 'center' }}>
        <CircularProgress sx={{ color: '#3B82F6' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, pb: 8, maxWidth: 1180, mx: 'auto' }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={panelSx}>
            <Stack alignItems="center" spacing={2}>
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  src={profileImage || undefined}
                  sx={{ width: 112, height: 112, bgcolor: '#3B82F6', fontSize: 42, fontWeight: 800 }}
                >
                  {(user?.full_name || 'U').charAt(0).toUpperCase()}
                </Avatar>
                <Tooltip title="Change profile photo">
                  <IconButton
                    component="label"
                    sx={{
                      position: 'absolute',
                      right: -4,
                      bottom: -4,
                      bgcolor: '#3B82F6',
                      color: 'white',
                      '&:hover': { bgcolor: '#2563EB' },
                    }}
                  >
                    <PhotoCameraIcon fontSize="small" />
                    <input hidden accept="image/png,image/jpeg,image/webp" type="file" onChange={handleImageChange} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Box sx={{ width: '100%' }}>
                <TextField label="Username" value={user?.full_name || ''} fullWidth disabled sx={fieldSx} />
                <TextField label="Email address" value={user?.email || ''} fullWidth disabled sx={{ ...fieldSx, mt: 2 }} />
                <TextField label="Role" value={(user?.role || '').replace(/_/g, ' ')} fullWidth disabled sx={{ ...fieldSx, mt: 2 }} />
              </Box>
              <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.1)', color: '#94A3B8', border: '1px solid rgba(59,130,246,0.25)' }}>
                Name and email are controlled by the account record. Profile photo and personal preferences are editable.
              </Alert>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={panelSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <LockResetIcon sx={{ color: '#3B82F6' }} />
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 800 }}>Password</Typography>
            </Box>
            {!showPasswordForm ? (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: '#64748B' }}>
                  Update your password with a strong 12+ character password.
                </Typography>
                <Button variant="contained" onClick={() => setShowPasswordForm(true)} sx={{ bgcolor: '#3B82F6', fontWeight: 700 }}>
                  Change Password
                </Button>
              </Box>
            ) : (
              <>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField label="Current password" type="password" value={passwords.current_password} onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })} fullWidth sx={fieldSx} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField helperText="12+ chars with upper, lower, number, special" label="New password" type="password" value={passwords.new_password} onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })} fullWidth sx={fieldSx} FormHelperTextProps={{ sx: { color: '#64748B' } }} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField label="Confirm password" type="password" value={passwords.confirm_password} onChange={(e) => setPasswords({ ...passwords, confirm_password: e.target.value })} fullWidth sx={fieldSx} />
                  </Grid>
                </Grid>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 2 }}>
                  <Button onClick={() => { setShowPasswordForm(false); setPasswords({ current_password: '', new_password: '', confirm_password: '' }); }} sx={{ color: '#64748B', fontWeight: 700 }}>
                    Cancel
                  </Button>
                  <Button variant="contained" disabled={savingPassword} onClick={changePassword} sx={{ bgcolor: '#3B82F6', fontWeight: 700 }}>
                    {savingPassword ? <CircularProgress size={20} color="inherit" /> : 'Update Password'}
                  </Button>
                </Box>
              </>
            )}
          </Paper>

          <Paper sx={{ ...panelSx, mt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <PsychologyIcon sx={{ color: '#8B5CF6' }} />
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 800 }}>AI Model Provider</Typography>
            </Box>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', my: 2 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
              <Box>
                <Typography sx={{ color: '#CBD5E1', fontWeight: 700 }}>
                  {preferences.ai_provider === 'gemini' ? 'Gemini API' : 'Local Ollama'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
                  Ollama is the default for analysis and assistance. Switch on only when a Gemini API key is configured.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" sx={{ color: preferences.ai_provider !== 'gemini' ? '#3B82F6' : '#64748B', fontWeight: 800 }}>
                  Ollama
                </Typography>
                <Switch
                  checked={preferences.ai_provider === 'gemini'}
                  onChange={(e) => setPreferences({ ...preferences, ai_provider: e.target.checked ? 'gemini' : 'ollama' })}
                />
                <Typography variant="caption" sx={{ color: preferences.ai_provider === 'gemini' ? '#8B5CF6' : '#64748B', fontWeight: 800 }}>
                  Gemini
                </Typography>
              </Stack>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button variant="outlined" disabled={savingPrefs} onClick={savePreferences} sx={{ borderColor: '#8B5CF6', color: '#8B5CF6', fontWeight: 700 }}>
                Save AI Provider
              </Button>
            </Box>
          </Paper>

          <Paper sx={{ ...panelSx, mt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <NotificationsIcon sx={{ color: '#10B981' }} />
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 800 }}>Preferences</Typography>
            </Box>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', my: 2 }} />
            {Object.keys(labelForPreference).map((key) => (
              <Box key={key} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1 }}>
                <Typography sx={{ color: '#CBD5E1', fontWeight: 600 }}>{labelForPreference[key]}</Typography>
                <Switch checked={Boolean(preferences[key])} onChange={(e) => setPreferences({ ...preferences, [key]: e.target.checked })} />
              </Box>
            ))}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button variant="outlined" disabled={savingPrefs} onClick={savePreferences} sx={{ borderColor: '#3B82F6', color: '#3B82F6', fontWeight: 700 }}>
                Save Settings
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

const panelSx = {
  p: 3,
  bgcolor: 'rgba(15,23,42,0.75)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 3,
};

const fieldSx = {
  '& input': { color: 'white' },
  '& label': { color: '#64748B' },
  '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
  '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#CBD5E1' },
  '& .MuiInputLabel-root.Mui-disabled': { color: '#64748B' },
};
