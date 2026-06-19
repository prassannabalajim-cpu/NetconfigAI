// @ts-nocheck
import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Tooltip, CircularProgress,
  TextField, InputAdornment, Select, MenuItem, FormControl, InputLabel,
  Pagination, Fade, Alert
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const getToken = () => sessionStorage.getItem('token');
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

const RISK_COLORS: Record<string, string> = {
  low: '#10B981', medium: '#F59E0B', high: '#F97316', critical: '#EF4444', unknown: '#6B7280'
};
const STATUS_COLORS: Record<string, string> = {
  pending_review: '#F59E0B', under_analysis: '#3B82F6', approved: '#10B981',
  rejected: '#EF4444', draft: '#6B7280', in_review: '#8B5CF6',
  failed: '#EF4444', closed: '#6B7280'
};

interface HistoryPageProps {
  onBack: () => void;
  onViewReview: (reviewId: string) => void;
}

export default function HistoryPage({ onBack, onViewReview }: HistoryPageProps) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalReviews, setTotalReviews] = useState(0);
  const PAGE_SIZE = 15;

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/reviews`, {
        headers: authHeaders(),
        params: { page, size: PAGE_SIZE }
      });
      setReviews(res.data);
      setTotalReviews(res.data.length === PAGE_SIZE ? page * PAGE_SIZE + 1 : (page - 1) * PAGE_SIZE + res.data.length);
      setError('');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to load review history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReviews(); }, [page]);

  const filtered = reviews.filter(r => {
    const matchSearch = !search ||
      r.title?.toLowerCase().includes(search.toLowerCase()) ||
      r.ticket_id?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchRisk = riskFilter === 'all' || r.risk_level === riskFilter;
    return matchSearch && matchStatus && matchRisk;
  });

  return (
    <Fade in>
      <Box sx={{ p: { xs: 2, md: 3 }, pb: 8, position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'white', mb: 0.5 }}>Review History</Typography>
            <Typography variant="body2" sx={{ color: '#64748B' }}>
              All network configuration change reviews
            </Typography>
          </Box>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchReviews} sx={{ color: '#64748B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, '&:hover': { color: 'white' } }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search by title or ticket ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#94A3B8' }} /></InputAdornment>,
                sx: { color: 'white', bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 }
              }}
              sx={{ flex: 1, minWidth: 200, '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' } }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel sx={{ color: '#94A3B8' }}>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
                sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.05)', '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' } }}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="under_analysis">Under Analysis</MenuItem>
                <MenuItem value="pending_review">Pending Review</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel sx={{ color: '#94A3B8' }}>Risk Level</InputLabel>
              <Select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                label="Risk Level"
                sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.05)', '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' } }}
              >
                <MenuItem value="all">All Risks</MenuItem>
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </Select>
            </FormControl>
            <Chip
              icon={<TrendingUpIcon />}
              label={`${filtered.length} results`}
              sx={{ bgcolor: 'rgba(59,130,246,0.15)', color: '#3B82F6', ml: 'auto' }}
            />
          </Box>
        </Paper>

        {/* Table */}
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Paper sx={{ bgcolor: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.03)' }}>
                  {['Title / Ticket ID', 'Config Type', 'Status', 'Risk Level', 'Risk Score', 'Compliance', 'Created', 'Actions'].map((h) => (
                    <TableCell key={h} sx={{ color: '#64748B', fontWeight: 700, borderColor: 'rgba(255,255,255,0.06)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ textAlign: 'center', py: 6, borderColor: 'rgba(255,255,255,0.06)' }}>
                      <CircularProgress size={32} sx={{ color: '#3B82F6' }} />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ textAlign: 'center', py: 6, borderColor: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}>
                      No reviews found. Upload your first configuration to get started!
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => {
                    const riskColor = RISK_COLORS[r.risk_level] || '#6B7280';
                    const statusColor = STATUS_COLORS[r.status] || '#6B7280';
                    return (
                      <TableRow
                        key={r.id}
                        sx={{
                          '&:hover': { bgcolor: 'rgba(59,130,246,0.05)', cursor: 'pointer' },
                          borderBottom: '1px solid rgba(255,255,255,0.04)'
                        }}
                        onClick={() => onViewReview(r.id)}
                      >
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#E2E8F0' }}>{r.title}</Typography>
                          {r.ticket_id && (
                            <Typography variant="caption" sx={{ color: '#64748B' }}>#{r.ticket_id}</Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                          <Chip label={r.config_type} size="small" sx={{ bgcolor: 'rgba(139,92,246,0.15)', color: '#8B5CF6', fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                          <Chip
                            label={r.status?.replace('_', ' ').toUpperCase()}
                            size="small"
                            sx={{ bgcolor: statusColor + '22', color: statusColor, fontWeight: 700, fontSize: '0.7rem' }}
                          />
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                          <Chip
                            label={r.risk_level?.toUpperCase() || 'UNKNOWN'}
                            size="small"
                            sx={{ bgcolor: riskColor + '22', color: riskColor, fontWeight: 700, fontSize: '0.7rem' }}
                          />
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.04)', color: riskColor, fontWeight: 700 }}>
                          {r.overall_risk_score != null ? `${Math.round(r.overall_risk_score)}/100` : '—'}
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.04)', color: '#10B981', fontWeight: 700 }}>
                          {r.compliance_score != null ? `${Math.round(r.compliance_score)}%` : '—'}
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.04)', color: '#64748B', fontSize: '0.78rem' }}>
                          {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); onViewReview(r.id); }}
                              sx={{ color: '#3B82F6', '&:hover': { bgcolor: 'rgba(59,130,246,0.1)' } }}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <Pagination
                count={Math.ceil(totalReviews / PAGE_SIZE) || 1}
                page={page}
                onChange={(_, v) => setPage(v)}
                sx={{
                  '& .MuiPaginationItem-root': { color: '#94A3B8' },
                  '& .Mui-selected': { bgcolor: 'rgba(59,130,246,0.3)' }
                }}
              />
            </Box>
          )}
        </Paper>
      </Box>
    </Fade>
  );
}
