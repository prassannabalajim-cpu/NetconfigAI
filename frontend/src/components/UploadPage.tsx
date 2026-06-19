// @ts-nocheck
import { useState } from 'react';
import {
  Box, Typography, Paper, Grid, Button, Chip, TextField, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem,
  FormControl, InputLabel, Alert, Fade, Stepper, Step, StepLabel
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import { toast } from 'react-toastify';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const getToken = () => sessionStorage.getItem('token');
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

const CONFIG_TYPES = [
  { value: 'AWS_SECURITY_GROUP', label: 'AWS Security Group' },
  { value: 'AWS_NACL', label: 'AWS Network ACL' },
  { value: 'CISCO_IOS', label: 'Cisco IOS Config' },
  { value: 'PALO_ALTO', label: 'Palo Alto Firewall' },
  { value: 'AZURE_NSG', label: 'Azure NSG' },
  { value: 'GCP_FIREWALL', label: 'GCP Firewall Rules' },
  { value: 'GENERIC_JSON', label: 'Generic JSON Config' },
  { value: 'GENERIC_YAML', label: 'Generic YAML Config' },
];

const COMPLIANCE_FRAMEWORKS = ['CIS', 'NIST', 'PCI-DSS', 'SOC2'];

interface UploadPageProps {
  onViewReview: (id: string) => void;
  onBack: () => void;
}

function DropZone({ label, subtitle, file, onDrop, id }: any) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => { if (files.length > 0) onDrop(files[0]); },
    maxFiles: 1,
    accept: { 'application/json': ['.json'], 'text/yaml': ['.yaml', '.yml'], 'text/plain': ['.txt', '.cfg', '.conf'] }
  });

  return (
    <Paper
      {...getRootProps()}
      id={id}
      sx={{
        p: 4,
        borderRadius: 3,
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
        bgcolor: isDragActive
          ? 'rgba(59,130,246,0.08)'
          : file
          ? 'rgba(16,185,129,0.05)'
          : 'rgba(15,23,42,0.6)',
        border: `2px dashed ${file ? '#10B981' : isDragActive ? '#3B82F6' : 'rgba(255,255,255,0.12)'}`,
        '&:hover': { borderColor: '#3B82F6', bgcolor: 'rgba(59,130,246,0.04)' },
        minHeight: 200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <input {...getInputProps()} />
      {file ? (
        <Box>
          <CheckCircleOutlineIcon sx={{ fontSize: 48, color: '#10B981', mb: 1.5 }} />
          <Typography variant="h6" sx={{ color: '#10B981', fontWeight: 700, mb: 0.5 }}>
            {label} Ready
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 0.5 }}>{file.name}</Typography>
          <Chip
            label={`${(file.size / 1024).toFixed(1)} KB`}
            size="small"
            sx={{ bgcolor: 'rgba(16,185,129,0.1)', color: '#10B981', fontWeight: 600 }}
          />
        </Box>
      ) : (
        <Box>
          <CloudUploadIcon sx={{ fontSize: 48, color: isDragActive ? '#3B82F6' : '#334155', mb: 1.5 }} />
          <Typography variant="h6" sx={{ color: '#E2E8F0', fontWeight: 600, mb: 0.5 }}>
            {label}
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 1 }}>{subtitle}</Typography>
          <Typography variant="caption" sx={{ color: '#475569' }}>
            Drop file here or click to browse
          </Typography>
          <br />
          <Typography variant="caption" sx={{ color: '#334155' }}>
            JSON • YAML • TXT • CFG • CONF
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

export default function UploadPage({ onViewReview, onBack }: UploadPageProps) {
  const [oldFile, setOldFile] = useState<File | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [configType, setConfigType] = useState('AWS_SECURITY_GROUP');
  const [frameworks, setFrameworks] = useState<string[]>(['CIS', 'NIST']);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewTitle, setReviewTitle] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  const activeStep = oldFile && newFile ? 2 : oldFile || newFile ? 1 : 0;

  const handleSubmit = async () => {
    if (!oldFile || !newFile || !reviewTitle) {
      toast.error('Please fill all required fields');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('old_file', oldFile);
      formData.append('new_file', newFile);
      formData.append('config_type', configType);
      formData.append('cloud_provider', configType.startsWith('AWS') ? 'AWS' : configType.startsWith('AZURE') ? 'AZURE' : configType.startsWith('GCP') ? 'GCP' : 'OTHER');

      const uploadRes = await axios.post(`${API_BASE}/api/v1/upload`, formData, { headers: authHeaders() });
      if (!uploadRes.data?.upload_id) throw new Error('Upload failed — no upload_id returned');

      const diffRes = await axios.post(
        `${API_BASE}/api/v1/diff`,
        {
          upload_id: uploadRes.data.upload_id,
          title: reviewTitle,
          config_type: configType,
          cloud_provider: configType.startsWith('AWS') ? 'AWS' : configType.startsWith('AZURE') ? 'AZURE' : configType.startsWith('GCP') ? 'GCP' : configType.startsWith('CISCO') ? 'CISCO' : 'OTHER',
          ticket_id: ticketId || undefined,
          description: description || undefined,
          compliance_frameworks: frameworks,
          auto_approve_if_low_risk: false,
          notify_manager: true,
        },
        { headers: authHeaders() }
      );
      if (!diffRes.data?.review_id) throw new Error('Analysis creation failed');

      toast.success('🚀 Analysis started! Redirecting to review...');
      setDialogOpen(false);
      setTimeout(() => onViewReview(diffRes.data.review_id), 1000);
    } catch (error: any) {
      toast.error(`❌ ${error.response?.data?.detail || error.message || 'Upload failed'}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Fade in>
      <Box sx={{ p: { xs: 2, md: 3 }, pb: 8, maxWidth: 1000, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
            sx={{ color: '#64748B', fontWeight: 600, '&:hover': { color: 'white' } }}
          >
            Back
          </Button>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'white' }}>
              New Configuration Analysis
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B' }}>
              Upload your old and new configuration files for AI-powered diff analysis
            </Typography>
          </Box>
        </Box>

        {/* Progress Steps */}
        <Paper sx={{ p: 3, mb: 4, bgcolor: 'rgba(15,23,42,0.75)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 3 }}>
          <Stepper activeStep={activeStep} sx={{ '& .MuiStepLabel-label': { color: '#64748B' }, '& .MuiStepLabel-label.Mui-active': { color: 'white' }, '& .MuiStepLabel-label.Mui-completed': { color: '#10B981' } }}>
            {['Upload Files', 'Configure Options', 'Submit & Analyze'].map(label => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>

        {/* Config Type */}
        <Paper sx={{ p: 3, mb: 3, bgcolor: 'rgba(15,23,42,0.75)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'white', mb: 2 }}>
            Configuration Type
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: '#64748B' }}>Config Type</InputLabel>
                <Select
                  value={configType}
                  onChange={(e) => setConfigType(e.target.value)}
                  label="Config Type"
                  sx={{
                    color: 'white',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  }}
                >
                  {CONFIG_TYPES.map(t => (
                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {COMPLIANCE_FRAMEWORKS.map(fw => (
                  <Chip
                    key={fw}
                    label={fw}
                    clickable
                    onClick={() => setFrameworks(prev =>
                      prev.includes(fw) ? prev.filter(f => f !== fw) : [...prev, fw]
                    )}
                    sx={{
                      bgcolor: frameworks.includes(fw) ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                      color: frameworks.includes(fw) ? '#3B82F6' : '#64748B',
                      border: `1px solid ${frameworks.includes(fw) ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.1)'}`,
                      fontWeight: 600,
                      '&:hover': { bgcolor: 'rgba(59,130,246,0.15)' },
                    }}
                  />
                ))}
              </Box>
              <Typography variant="caption" sx={{ color: '#334155', mt: 0.5, display: 'block' }}>
                Select compliance frameworks to validate against
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Upload Zones */}
        <Grid container spacing={3} sx={{ mb: 4 }} id="upload-zones">
          <Grid item xs={12} md={6}>
            <DropZone
              label="Old Configuration"
              subtitle="Baseline / Current production state"
              file={oldFile}
              onDrop={setOldFile}
              id="old-config-dropzone"
            />
            {oldFile && (
              <Button size="small" onClick={() => setOldFile(null)} sx={{ mt: 1, color: '#475569' }}>
                Clear
              </Button>
            )}
          </Grid>
          <Grid item xs={12} md={6}>
            <DropZone
              label="New Configuration"
              subtitle="Proposed changes / Updated state"
              file={newFile}
              onDrop={setNewFile}
              id="new-config-dropzone"
            />
            {newFile && (
              <Button size="small" onClick={() => setNewFile(null)} sx={{ mt: 1, color: '#475569' }}>
                Clear
              </Button>
            )}
          </Grid>
        </Grid>

        {/* Action */}
        {oldFile && newFile && (
          <Alert
            severity="info"
            sx={{ mb: 3, bgcolor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 2, color: '#94A3B8' }}
          >
                      Both files ready. Click <strong>Submit & Analyze</strong> to start Ollama AI analysis.
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            onClick={() => { setOldFile(null); setNewFile(null); }}
            disabled={!oldFile && !newFile}
            sx={{ color: '#64748B', fontWeight: 600 }}
          >
            Clear All
          </Button>
          <Button
            variant="contained"
            size="large"
            disabled={!oldFile || !newFile}
            onClick={() => setDialogOpen(true)}
            id="submit-analyze-btn"
            startIcon={<SendIcon />}
            sx={{
              bgcolor: '#3B82F6',
              fontWeight: 700,
              borderRadius: 2,
              px: 5,
              boxShadow: '0 4px 20px rgba(59,130,246,0.4)',
              '&:hover': { bgcolor: '#2563EB' },
              '&:disabled': { bgcolor: 'rgba(255,255,255,0.06)', color: '#334155' },
            }}
          >
            Submit & Analyze
          </Button>
        </Box>

        {/* Review Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={() => !uploading && setDialogOpen(false)}
          PaperProps={{
            sx: {
              bgcolor: '#0F172A',
              color: 'white',
              minWidth: 460,
              borderRadius: 3,
              border: '1px solid rgba(255,255,255,0.09)',
            },
          }}
        >
          <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem', pb: 1 }}>
            Review Details
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
              Provide context for this configuration change analysis.
            </Typography>
            <TextField
              autoFocus
              fullWidth
              label="Review Title *"
              value={reviewTitle}
              onChange={(e) => setReviewTitle(e.target.value)}
              disabled={uploading}
              sx={{ mb: 2, '& input': { color: 'white' }, '& label': { color: '#64748B' }, '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' } }}
            />
            <TextField
              fullWidth
              label="Ticket ID (Optional)"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              disabled={uploading}
              placeholder="e.g. NETOPS-1234"
              sx={{ mb: 2, '& input': { color: 'white' }, '& label': { color: '#64748B' }, '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' } }}
            />
            <TextField
              fullWidth
              label="Description (Optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={uploading}
              multiline
              rows={2}
              placeholder="Brief description of the change reason..."
              sx={{ mb: 2, '& textarea': { color: 'white' }, '& label': { color: '#64748B' }, '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' } }}
            />
            <Alert
              severity="info"
              sx={{ bgcolor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#94A3B8', borderRadius: 2 }}
            >
              Ollama AI will analyze your configuration changes for security risks, compliance violations, and generate an executive report.
            </Alert>
          </DialogContent>
          <DialogActions sx={{ p: 3, gap: 1 }}>
            <Button onClick={() => setDialogOpen(false)} disabled={uploading} sx={{ color: '#64748B', fontWeight: 600 }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={uploading || !reviewTitle}
              sx={{ bgcolor: '#3B82F6', fontWeight: 700, borderRadius: 2, px: 4, '&:hover': { bgcolor: '#2563EB' } }}
            >
              {uploading ? <CircularProgress size={20} color="inherit" /> : '🚀 Submit & Analyze'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
}
