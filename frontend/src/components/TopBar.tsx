// @ts-nocheck
import { useState } from 'react';
import {
  AppBar, Toolbar, Box, Typography, IconButton,
  Badge, Tooltip, Chip
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import RefreshIcon from '@mui/icons-material/Refresh';
import { AppPage } from './Sidebar';

const PAGE_LABELS: Record<AppPage, { title: string; subtitle: string }> = {
  dashboard: { title: 'Enterprise Dashboard', subtitle: 'Real-time overview of all configuration reviews' },
  upload: { title: 'New Analysis', subtitle: 'Upload and submit configuration files for AI-powered review' },
  history: { title: 'Review History', subtitle: 'Complete audit trail of all network configuration reviews' },
  'review-detail': { title: 'Review Details', subtitle: 'Detailed analysis, diff results, and workflow actions' },
  compliance: { title: 'Compliance Overview', subtitle: 'Aggregated CIS & NIST compliance findings across all reviews' },
  'audit-log': { title: 'Audit Log', subtitle: 'Enterprise-level event trail for all system activities' },
  help: { title: 'Help & Documentation', subtitle: 'User guide, FAQ, and onboarding resources' },
  settings: { title: 'Settings', subtitle: 'Configure your preferences and account settings' },
};

interface TopBarProps {
  currentPage: AppPage;
  pendingCount?: number;
  onRefresh?: () => void;
  sidebarWidth: number;
}

export default function TopBar({ currentPage, pendingCount = 0, onRefresh, sidebarWidth }: TopBarProps) {
  const info = PAGE_LABELS[currentPage] || PAGE_LABELS.dashboard;

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        left: sidebarWidth,
        width: `calc(100% - ${sidebarWidth}px)`,
        bgcolor: 'rgba(10,17,32,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1), width 0.25s cubic-bezier(0.4,0,0.2,1)',
        zIndex: 1100,
      }}
    >
      <Toolbar sx={{ minHeight: 64, px: 3 }}>
        <Box sx={{ flex: 1 }}>
          <Typography
            variant="h6"
            sx={{ fontWeight: 800, color: 'white', fontSize: '1rem', lineHeight: 1.2 }}
          >
            {info.title}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: '#475569', fontWeight: 400, display: { xs: 'none', sm: 'block' } }}
          >
            {info.subtitle}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {onRefresh && (
            <Tooltip title="Refresh">
              <IconButton
                onClick={onRefresh}
                size="small"
                sx={{ color: '#64748B', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.08)' } }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={`${pendingCount} pending approvals`}>
            <IconButton
              size="small"
              sx={{ color: '#64748B', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.08)' } }}
            >
              <Badge badgeContent={pendingCount || null} color="warning">
                <NotificationsIcon fontSize="small" />
              </Badge>
            </IconButton>
          </Tooltip>
          <Chip
            label="v1.0.0"
            size="small"
            sx={{
              ml: 1,
              bgcolor: 'rgba(59,130,246,0.1)',
              color: '#475569',
              fontSize: '0.65rem',
              fontWeight: 600,
              display: { xs: 'none', md: 'flex' },
            }}
          />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
