// @ts-nocheck
import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Chip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, InputAdornment, Select, MenuItem, FormControl, InputLabel,
  Pagination, Fade, Tooltip, IconButton
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AssignmentIcon from '@mui/icons-material/Assignment';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const EVENT_COLORS: Record<string, string> = {
  REVIEW_APPROVED: '#10B981',
  REVIEW_REJECTED: '#EF4444',
  REVIEW_ESCALATED: '#F59E0B',
  REVIEW_CREATED: '#3B82F6',
  REVIEW_SUBMITTED: '#8B5CF6',
  AUTH_LOGIN: '#64748B',
  AUTH_LOGOUT: '#64748B',
  REPORT_GENERATED: '#06B6D4',
  ANALYSIS_COMPLETED: '#10B981',
  ANALYSIS_FAILED: '#EF4444',
};

const EVENT_ICONS: Record<string, any> = {
  REVIEW_APPROVED: <CheckCircleIcon sx={{ fontSize: 16, color: '#10B981' }} />,
  REVIEW_REJECTED: <CancelIcon sx={{ fontSize: 16, color: '#EF4444' }} />,
  REVIEW_ESCALATED: <WarningIcon sx={{ fontSize: 16, color: '#F59E0B' }} />,
};

const formatEvent = (eventType: string) =>
  (eventType || 'UNKNOWN_EVENT').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const cleanDescription = (value: string) => {
  if (!value) return 'System event recorded';
  return String(value)
    .replace(/\{[^}]*\}/g, '[details hidden]')
    .replace(/\[[^\]]*\]/g, '[details hidden]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
    .slice(0, 180);
};

const formatUser = (email?: string) => {
  if (!email) return 'System';
  if (email.includes('@')) return email;
  return 'Authenticated user';
};

const formatAuditTime = (value?: string) => {
  if (!value) return '-';
  const normalized = /z$|[+-]\d\d:\d\d$/i.test(value) ? value : `${value}Z`;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(new Date(normalized));
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/audit`, {
        params: { page, size: PAGE_SIZE }
      });
      setLogs(res.data);
    } catch (e) {
      console.error('Failed to fetch audit logs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [page]);

  const filtered = logs.filter(log => {
    const searchText = search.toLowerCase();
    const matchSearch = !search ||
      cleanDescription(log.event_description).toLowerCase().includes(searchText) ||
      formatUser(log.user_email).toLowerCase().includes(searchText) ||
      formatEvent(log.event_type).toLowerCase().includes(searchText);
    const matchEvent = eventFilter === 'all' || log.event_type === eventFilter;
    return matchSearch && matchEvent;
  });

  const uniqueEvents = [...new Set(logs.map(l => l.event_type))].filter(Boolean);

  return (
    <Fade in>
      <Box sx={{ p: { xs: 2, md: 3 }, pb: 8 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 4 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'white', mb: 0.5 }}>
              Audit Log
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B' }}>
              Enterprise event trail for account, review, report, and analysis activity
            </Typography>
          </Box>
          <Tooltip title="Refresh">
            <IconButton
              onClick={fetchLogs}
              sx={{ color: '#64748B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, '&:hover': { color: 'white' } }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(15,23,42,0.75)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search by event, user, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#64748B', fontSize: 18 }} /></InputAdornment>,
                sx: { color: 'white', bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2 }
              }}
              sx={{ flex: 1, minWidth: 200, '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' } }}
            />
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel sx={{ color: '#64748B' }}>Event Type</InputLabel>
              <Select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                label="Event Type"
                sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.04)', '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' } }}
              >
                <MenuItem value="all">All Events</MenuItem>
                {uniqueEvents.map(e => <MenuItem key={e} value={e}>{formatEvent(e)}</MenuItem>)}
              </Select>
            </FormControl>
            <Chip
              label={`${filtered.length} events`}
              sx={{ bgcolor: 'rgba(59,130,246,0.12)', color: '#3B82F6', fontWeight: 700, ml: 'auto' }}
            />
          </Box>
        </Paper>

        <Paper sx={{ bgcolor: 'rgba(15,23,42,0.75)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
          {loading ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <CircularProgress size={28} sx={{ color: '#3B82F6' }} />
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ p: 8, textAlign: 'center' }}>
              <AssignmentIcon sx={{ fontSize: 52, color: '#1E293B', mb: 2 }} />
              <Typography sx={{ color: '#475569' }}>
                {logs.length === 0 ? 'No audit events recorded yet.' : 'No events match your filter.'}
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
                    {['', 'Event Type', 'Description', 'User', 'Role', 'Timestamp'].map(h => (
                      <TableCell
                        key={h}
                        sx={{
                          color: '#334155', fontWeight: 700, fontSize: '0.7rem',
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          borderColor: 'rgba(255,255,255,0.05)', py: 1.5,
                        }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((log, i) => {
                    const color = EVENT_COLORS[log.event_type] || '#64748B';
                    return (
                      <TableRow
                        key={log.id || i}
                        sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' }, borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                      >
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.03)', width: 32 }}>
                          {EVENT_ICONS[log.event_type] || <InfoIcon sx={{ fontSize: 16, color: '#334155' }} />}
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                          <Chip
                            label={formatEvent(log.event_type)}
                            size="small"
                            sx={{ bgcolor: `${color}18`, color, fontSize: '0.65rem', fontWeight: 700, height: 20 }}
                          />
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.03)', color: '#94A3B8', fontSize: '0.78rem', width: '34%', minWidth: 300, pr: 3 }}>
                          <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                            {cleanDescription(log.event_description)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.03)', color: '#64748B', fontSize: '0.75rem', minWidth: 220, pr: 3, overflowWrap: 'anywhere' }}>
                          {formatUser(log.user_email)}
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                          <Chip
                            label={(log.user_role || 'system').replace(/_/g, ' ').toUpperCase()}
                            size="small"
                            sx={{ bgcolor: 'rgba(139,92,246,0.1)', color: '#8B5CF6', fontSize: '0.6rem', fontWeight: 700, height: 18 }}
                          />
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.03)', color: '#475569', fontSize: '0.72rem', minWidth: 190, whiteSpace: 'normal' }}>
                          {formatAuditTime(log.created_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {!loading && filtered.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <Pagination
                count={5}
                page={page}
                onChange={(_, v) => setPage(v)}
                sx={{
                  '& .MuiPaginationItem-root': { color: '#64748B' },
                  '& .Mui-selected': { bgcolor: 'rgba(59,130,246,0.2)', color: '#3B82F6' },
                }}
              />
            </Box>
          )}
        </Paper>
      </Box>
    </Fade>
  );
}
