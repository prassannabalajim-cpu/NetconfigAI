// @ts-nocheck
import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  LinearProgress, IconButton, Tooltip, Fade, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, CartesianGrid, Cell } from 'recharts';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const getToken = () => sessionStorage.getItem('token');
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

interface CompliancePageProps {
  onViewReview: (id: string) => void;
}

export default function CompliancePage({ onViewReview }: CompliancePageProps) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [framework, setFramework] = useState('all');

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/reviews`, {
        headers: authHeaders(),
        params: { page: 1, size: 50 },
      });
      setReviews(res.data);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReviews(); }, []);

  // Aggregate compliance data from reviews
  const allFindings = reviews.flatMap(r => (r.compliance_findings || []));
  const filtered = framework === 'all' ? allFindings : allFindings.filter(f => f.framework === framework);

  const passCount = filtered.filter(f => f.status === 'PASS').length;
  const failCount = filtered.filter(f => f.status === 'FAIL').length;
  const totalCount = filtered.length;
  const passRate = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 100;

  // Framework breakdown
  const frameworks = ['CIS', 'NIST', 'PCI-DSS', 'SOC2'];
  const frameworkData = frameworks.map(fw => {
    const fFindings = allFindings.filter(f => f.framework === fw);
    const fPass = fFindings.filter(f => f.status === 'PASS').length;
    const fFail = fFindings.filter(f => f.status === 'FAIL').length;
    return { name: fw, Pass: fPass, Fail: fFail, total: fPass + fFail };
  }).filter(d => d.total > 0);

  // Severity breakdown
  const severityData = [
    { name: 'Critical', count: filtered.filter(f => f.severity === 'CRITICAL' && f.status === 'FAIL').length, color: '#EF4444' },
    { name: 'High', count: filtered.filter(f => f.severity === 'HIGH' && f.status === 'FAIL').length, color: '#F97316' },
    { name: 'Medium', count: filtered.filter(f => f.severity === 'MEDIUM' && f.status === 'FAIL').length, color: '#F59E0B' },
    { name: 'Low', count: filtered.filter(f => f.severity === 'LOW' && f.status === 'FAIL').length, color: '#10B981' },
  ].filter(s => s.count > 0);

  return (
    <Fade in>
      <Box sx={{ p: { xs: 2, md: 3 }, pb: 8 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 4 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'white', mb: 0.5 }}>
              Compliance Overview
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B' }}>
              Aggregated CIS & NIST compliance findings across all reviews
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel sx={{ color: '#64748B' }}>Framework</InputLabel>
              <Select
                value={framework}
                onChange={e => setFramework(e.target.value)}
                label="Framework"
                sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.04)', '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' } }}
              >
                <MenuItem value="all">All Frameworks</MenuItem>
                {frameworks.map(fw => <MenuItem key={fw} value={fw}>{fw}</MenuItem>)}
              </Select>
            </FormControl>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchReviews} sx={{ color: '#64748B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Stat Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {[
            { label: 'Overall Pass Rate', value: `${passRate}%`, color: passRate >= 80 ? '#10B981' : passRate >= 60 ? '#F59E0B' : '#EF4444' },
            { label: 'Controls Passed', value: passCount, color: '#10B981' },
            { label: 'Controls Failed', value: failCount, color: '#EF4444' },
            { label: 'Total Controls', value: totalCount, color: '#3B82F6' },
          ].map(s => (
            <Grid item xs={6} md={3} key={s.label}>
              <Paper sx={{
                p: 3, borderRadius: 3, bgcolor: 'rgba(15,23,42,0.75)',
                border: `1px solid ${s.color}22`, textAlign: 'center',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 8px 32px ${s.color}22` },
                transition: 'all 0.2s',
              }}>
                <Typography variant="h3" sx={{ color: s.color, fontWeight: 900, mb: 0.5 }}>
                  {loading ? '—' : s.value}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>{s.label}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Overall Progress Bar */}
        <Paper sx={{ p: 3, mb: 4, bgcolor: 'rgba(15,23,42,0.75)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ color: '#94A3B8', fontWeight: 700 }}>
              Overall Compliance Score
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: passRate >= 80 ? '#10B981' : passRate >= 60 ? '#F59E0B' : '#EF4444' }}>
              {passRate}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={passRate}
            sx={{
              height: 12, borderRadius: 6, bgcolor: 'rgba(255,255,255,0.06)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 6,
                bgcolor: passRate >= 80 ? '#10B981' : passRate >= 60 ? '#F59E0B' : '#EF4444',
              },
            }}
          />
          <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
            {severityData.map(s => (
              <Box key={s.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
                <Typography variant="caption" sx={{ color: '#64748B' }}>{s.count} {s.name}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>

        {/* Framework Bar Chart */}
        {frameworkData.length > 0 && (
          <Paper sx={{ p: 3, mb: 4, bgcolor: 'rgba(15,23,42,0.75)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'white', mb: 2 }}>
              Framework Breakdown
            </Typography>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={frameworkData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                <ReTooltip
                  contentStyle={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: 'white' }}
                  itemStyle={{ color: '#94A3B8' }}
                />
                <Bar dataKey="Pass" fill="#10B981" radius={[4, 4, 0, 0]} name="Pass" />
                <Bar dataKey="Fail" fill="#EF4444" radius={[4, 4, 0, 0]} name="Fail" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        )}

        {/* Findings Table */}
        <Paper sx={{ bgcolor: 'rgba(15,23,42,0.75)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'white' }}>
              Compliance Findings
            </Typography>
          </Box>
          {loading ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <CircularProgress size={28} sx={{ color: '#3B82F6' }} />
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ p: 8, textAlign: 'center' }}>
              <ShieldIcon sx={{ fontSize: 52, color: '#1E293B', mb: 2 }} />
              <Typography sx={{ color: '#475569' }}>
                {allFindings.length === 0
                  ? 'No compliance data yet. Submit a review to see findings.'
                  : 'No findings for selected framework.'}
              </Typography>
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
                    {['Status', 'Framework', 'Control', 'Severity', 'Description', 'Remediation'].map(h => (
                      <TableCell
                        key={h}
                        sx={{ color: '#334155', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', borderColor: 'rgba(255,255,255,0.05)', bgcolor: '#0A1120' }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.slice(0, 50).map((f, i) => (
                    <TableRow key={i} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' }, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                        {f.status === 'PASS'
                          ? <CheckCircleIcon sx={{ color: '#10B981', fontSize: 18 }} />
                          : <CancelIcon sx={{ color: '#EF4444', fontSize: 18 }} />
                        }
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                        <Chip label={f.framework} size="small" sx={{ bgcolor: 'rgba(139,92,246,0.12)', color: '#8B5CF6', fontSize: '0.65rem', fontWeight: 700 }} />
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.03)', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 600 }}>
                        {f.control_id}
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                        <Chip
                          label={f.severity}
                          size="small"
                          sx={{
                            bgcolor: f.severity === 'CRITICAL' ? '#EF444422' : f.severity === 'HIGH' ? '#F9731622' : f.severity === 'MEDIUM' ? '#F59E0B22' : '#10B98122',
                            color: f.severity === 'CRITICAL' ? '#EF4444' : f.severity === 'HIGH' ? '#F97316' : f.severity === 'MEDIUM' ? '#F59E0B' : '#10B981',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.03)', color: '#64748B', fontSize: '0.75rem', maxWidth: 200 }}>
                        <Typography noWrap variant="caption" sx={{ color: '#64748B' }}>
                          {f.finding_description}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.03)', color: '#475569', fontSize: '0.72rem', maxWidth: 180 }}>
                        <Typography noWrap variant="caption" sx={{ color: '#3B82F6' }}>
                          {f.remediation_guidance || '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>
    </Fade>
  );
}
