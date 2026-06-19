// @ts-nocheck
import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, Button, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, Fade, LinearProgress
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import WarningIcon from '@mui/icons-material/Warning';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SecurityIcon from '@mui/icons-material/Security';
import ShieldIcon from '@mui/icons-material/Shield';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PendingIcon from '@mui/icons-material/Pending';
import { toast } from 'react-toastify';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip, Legend
} from 'recharts';
import axios from 'axios';
import { AppPage } from './Sidebar';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const getToken = () => sessionStorage.getItem('token');
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

const RISK_COLORS: Record<string, string> = {
  low: '#10B981', medium: '#F59E0B', high: '#F97316', critical: '#EF4444', unknown: '#6B7280'
};
const STATUS_COLORS: Record<string, string> = {
  pending_review: '#F59E0B', under_analysis: '#3B82F6', approved: '#10B981',
  rejected: '#EF4444', draft: '#6B7280', in_review: '#8B5CF6', failed: '#EF4444', closed: '#6B7280'
};

interface DashboardProps {
  onViewReview: (id: string) => void;
  onNavigate: (page: AppPage) => void;
}

export default function Dashboard({ onViewReview, onNavigate }: DashboardProps) {
  const [stats, setStats] = useState({
    total_reviews: 0,
    open_reviews: 0,
    high_risk_findings: 0,
    compliance_violations: 0,
    pending_approvals: 0,
  });
  const [recentReviews, setRecentReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const [statsRes, reviewsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/v1/dashboard`, { headers: authHeaders() }),
        axios.get(`${API_BASE}/api/v1/reviews`, { headers: authHeaders(), params: { page: 1, size: 8 } }),
      ]);
      setStats(statsRes.data);
      setRecentReviews(reviewsRes.data);
    } catch (e: any) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(() => fetchAll(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    fetchAll(true);
    toast.info('Dashboard refreshed');
  };

  const riskDist = ['low', 'medium', 'high', 'critical'].map(r => ({
    name: r.toUpperCase(),
    value: recentReviews.filter(rv => rv.risk_level === r).length,
    fill: RISK_COLORS[r]
  })).filter(d => d.value > 0);

  const statCards = [
    {
      title: 'Total Reviews',
      value: stats.total_reviews,
      color: '#3B82F6',
      icon: <AssessmentIcon />,
      sub: 'All time',
      trend: null,
    },
    {
      title: 'Open Reviews',
      value: stats.open_reviews,
      color: '#F59E0B',
      icon: <PendingIcon />,
      sub: 'Awaiting action',
    },
    {
      title: 'High Risk Findings',
      value: stats.high_risk_findings,
      color: '#EF4444',
      icon: <WarningIcon />,
      sub: 'Critical & High',
    },
    {
      title: 'Compliance Violations',
      value: stats.compliance_violations,
      color: '#F97316',
      icon: <SecurityIcon />,
      sub: 'CIS & NIST',
    },
    {
      title: 'Pending Approvals',
      value: stats.pending_approvals,
      color: '#8B5CF6',
      icon: <ShieldIcon />,
      sub: 'Needs review',
    },
  ];

  const complianceRate = stats.compliance_violations === 0 && stats.total_reviews === 0
    ? 100
    : stats.total_reviews > 0
    ? Math.max(0, Math.round(100 - (stats.compliance_violations / (stats.total_reviews * 5)) * 100))
    : 100;

  return (
    <Fade in>
      <Box sx={{ p: { xs: 2, md: 3 }, pb: 8 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 4 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'white', mb: 0.5 }}>
              Enterprise Dashboard
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B' }}>
              Real-time overview — auto-refreshes every 30 seconds
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="contained"
              startIcon={<CloudUploadIcon />}
              onClick={() => onNavigate('upload')}
              id="dashboard-new-analysis-btn"
              sx={{
                bgcolor: '#3B82F6',
                fontWeight: 700,
                borderRadius: 2,
                px: 3,
                boxShadow: '0 4px 20px rgba(59,130,246,0.35)',
                '&:hover': { bgcolor: '#2563EB', boxShadow: '0 6px 24px rgba(59,130,246,0.5)' },
              }}
            >
              New Analysis
            </Button>
            <Tooltip title="Refresh Dashboard">
              <IconButton
                onClick={handleRefresh}
                disabled={refreshing}
                sx={{
                  color: '#64748B',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 2,
                  '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.06)' },
                }}
              >
                <RefreshIcon sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Stat Cards */}
        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          {statCards.map((stat) => (
            <Grid item xs={6} sm={4} md key={stat.title}>
              <Paper
                sx={{
                  p: 3,
                  borderRadius: 3,
                  bgcolor: 'rgba(15,23,42,0.75)',
                  backdropFilter: 'blur(12px)',
                  border: `1px solid ${stat.color}22`,
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 8px 32px ${stat.color}22`,
                    borderColor: `${stat.color}44`,
                  },
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#64748B',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      fontSize: '0.68rem',
                    }}
                  >
                    {stat.title}
                  </Typography>
                  <Box sx={{ color: stat.color, opacity: 0.65, display: 'flex' }}>{stat.icon}</Box>
                </Box>
                <Typography
                  variant="h3"
                  sx={{ color: stat.color, fontWeight: 900, lineHeight: 1, mb: 0.5 }}
                >
                  {loading ? '—' : stat.value}
                </Typography>
                <Typography variant="caption" sx={{ color: '#475569' }}>
                  {stat.sub}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Charts + Compliance Row */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Risk Distribution Pie */}
          <Grid item xs={12} md={5}>
            <Paper
              sx={{
                p: 3,
                bgcolor: 'rgba(15,23,42,0.75)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 3,
                height: '100%',
                minHeight: 280,
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: 'white', fontSize: '0.95rem' }}>
                Risk Distribution
              </Typography>
              {riskDist.length === 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 2 }}>
                  <AssessmentIcon sx={{ fontSize: 48, color: '#1E293B' }} />
                  <Typography variant="body2" sx={{ color: '#334155', textAlign: 'center' }}>
                    No reviews yet.<br />Start your first analysis to see data here.
                  </Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={riskDist}
                      cx="50%"
                      cy="50%"
                      outerRadius={85}
                      innerRadius={45}
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {riskDist.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <ReTooltip
                      contentStyle={{
                        background: '#0F172A',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        color: 'white',
                      }}
                    />
                    <Legend
                      formatter={(value) => (
                        <span style={{ color: '#94A3B8', fontSize: '0.78rem' }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>

          {/* Compliance Health */}
          <Grid item xs={12} md={7}>
            <Paper
              sx={{
                p: 3,
                bgcolor: 'rgba(15,23,42,0.75)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 3,
                height: '100%',
                minHeight: 280,
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: 'white', fontSize: '0.95rem' }}>
                Compliance Health
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ color: '#94A3B8', fontWeight: 600 }}>
                    Overall Compliance Score
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 800,
                      color: complianceRate >= 80 ? '#10B981' : complianceRate >= 60 ? '#F59E0B' : '#EF4444',
                    }}
                  >
                    {complianceRate}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={complianceRate}
                  sx={{
                    height: 10,
                    borderRadius: 5,
                    bgcolor: 'rgba(255,255,255,0.06)',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 5,
                      bgcolor: complianceRate >= 80 ? '#10B981' : complianceRate >= 60 ? '#F59E0B' : '#EF4444',
                    },
                  }}
                />
              </Box>

              {/* Quick Status Summary */}
              <Grid container spacing={2}>
                {[
                  { label: 'Approved', value: recentReviews.filter(r => r.status === 'approved').length, color: '#10B981', icon: <CheckCircleIcon sx={{ fontSize: 18 }} /> },
                  { label: 'Pending Review', value: recentReviews.filter(r => r.status === 'pending_review').length, color: '#F59E0B', icon: <PendingIcon sx={{ fontSize: 18 }} /> },
                  { label: 'Rejected', value: recentReviews.filter(r => r.status === 'rejected').length, color: '#EF4444', icon: <ErrorIcon sx={{ fontSize: 18 }} /> },
                  { label: 'Analyzing', value: recentReviews.filter(r => r.status === 'under_analysis').length, color: '#3B82F6', icon: <TrendingUpIcon sx={{ fontSize: 18 }} /> },
                ].map(item => (
                  <Grid item xs={6} key={item.label}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 1.5,
                        bgcolor: `${item.color}11`,
                        borderRadius: 2,
                        border: `1px solid ${item.color}22`,
                      }}
                    >
                      <Box sx={{ color: item.color }}>{item.icon}</Box>
                      <Box>
                        <Typography variant="h6" sx={{ color: item.color, fontWeight: 800, lineHeight: 1 }}>
                          {loading ? '—' : item.value}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.7rem' }}>
                          {item.label}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>

              <Box sx={{ mt: 2, textAlign: 'right' }}>
                <Button
                  size="small"
                  onClick={() => onNavigate('compliance')}
                  sx={{ color: '#3B82F6', fontWeight: 600, fontSize: '0.75rem' }}
                >
                  View Full Compliance Report →
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Recent Reviews Table */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'white', fontSize: '0.95rem' }}>
              Recent Reviews
            </Typography>
            <Button
              size="small"
              onClick={() => onNavigate('history')}
              sx={{ color: '#3B82F6', fontWeight: 600, fontSize: '0.75rem' }}
            >
              View All History →
            </Button>
          </Box>

          <Paper
            sx={{
              bgcolor: 'rgba(15,23,42,0.75)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            {loading ? (
              <Box sx={{ p: 6, textAlign: 'center' }}>
                <CircularProgress size={28} sx={{ color: '#3B82F6' }} />
              </Box>
            ) : recentReviews.length === 0 ? (
              <Box sx={{ p: 8, textAlign: 'center' }}>
                <AssessmentIcon sx={{ fontSize: 52, color: '#1E293B', mb: 2 }} />
                <Typography variant="h6" sx={{ color: '#475569', mb: 1, fontWeight: 600 }}>
                  No reviews yet
                </Typography>
                <Typography variant="body2" sx={{ color: '#334155', mb: 3 }}>
                  Upload your first configuration files to generate an AI-powered analysis
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<CloudUploadIcon />}
                  onClick={() => onNavigate('upload')}
                  sx={{ bgcolor: '#3B82F6', fontWeight: 700, borderRadius: 2 }}
                >
                  Start First Analysis
                </Button>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
                      {['Title', 'Status', 'Risk', 'Score', 'Compliance', 'Date', ''].map(h => (
                        <TableCell
                          key={h}
                          sx={{
                            color: '#334155',
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            borderColor: 'rgba(255,255,255,0.05)',
                            py: 1.5,
                          }}
                        >
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentReviews.slice(0, 8).map((r) => {
                      const riskColor = RISK_COLORS[r.risk_level] || '#6B7280';
                      const statusColor = STATUS_COLORS[r.status] || '#6B7280';
                      return (
                        <TableRow
                          key={r.id}
                          onClick={() => onViewReview(r.id)}
                          sx={{
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'rgba(59,130,246,0.05)' },
                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                          }}
                        >
                          <TableCell sx={{ borderColor: 'rgba(255,255,255,0.03)', maxWidth: 200 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#E2E8F0', fontSize: '0.8rem' }} noWrap>
                              {r.title}
                            </Typography>
                            {r.ticket_id && (
                              <Typography variant="caption" sx={{ color: '#475569' }}>
                                #{r.ticket_id}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                            <Chip
                              label={r.status?.replace(/_/g, ' ').toUpperCase()}
                              size="small"
                              sx={{ bgcolor: `${statusColor}22`, color: statusColor, fontWeight: 700, fontSize: '0.65rem', height: 20 }}
                            />
                          </TableCell>
                          <TableCell sx={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                            <Chip
                              label={r.risk_level?.toUpperCase() || 'UNKNOWN'}
                              size="small"
                              sx={{ bgcolor: `${riskColor}22`, color: riskColor, fontWeight: 700, fontSize: '0.65rem', height: 20 }}
                            />
                          </TableCell>
                          <TableCell sx={{ borderColor: 'rgba(255,255,255,0.03)', color: riskColor, fontWeight: 700, fontSize: '0.8rem' }}>
                            {r.overall_risk_score != null ? `${Math.round(r.overall_risk_score)}/100` : '—'}
                          </TableCell>
                          <TableCell sx={{ borderColor: 'rgba(255,255,255,0.03)', color: '#10B981', fontWeight: 700, fontSize: '0.8rem' }}>
                            {r.compliance_score != null ? `${Math.round(r.compliance_score)}%` : '—'}
                          </TableCell>
                          <TableCell sx={{ borderColor: 'rgba(255,255,255,0.03)', color: '#475569', fontSize: '0.75rem' }}>
                            {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell sx={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                            <Tooltip title="View Details">
                              <IconButton
                                size="small"
                                sx={{ color: '#334155', '&:hover': { color: '#3B82F6' } }}
                                onClick={(e) => { e.stopPropagation(); onViewReview(r.id); }}
                              >
                                <VisibilityIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Box>
      </Box>
    </Fade>
  );
}
