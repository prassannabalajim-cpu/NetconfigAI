// @ts-nocheck
import { useState } from 'react';
import {
  Box, Typography, Tooltip, Divider, Avatar, Chip,
  IconButton, Badge
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import HistoryIcon from '@mui/icons-material/History';
import ShieldIcon from '@mui/icons-material/Shield';
import AssignmentIcon from '@mui/icons-material/Assignment';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import SecurityIcon from '@mui/icons-material/Security';
import NotificationsIcon from '@mui/icons-material/Notifications';

export type AppPage = 'dashboard' | 'upload' | 'history' | 'review-detail' | 'compliance' | 'audit-log' | 'help' | 'settings';

interface SidebarProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  onLogout: () => void;
  userName: string;
  userRole: string;
  pendingCount?: number;
}

const NAV_ITEMS = [
  { page: 'dashboard' as AppPage, label: 'Dashboard', icon: <DashboardIcon />, id: 'nav-dashboard' },
  { page: 'upload' as AppPage, label: 'New Analysis', icon: <CloudUploadIcon />, id: 'nav-upload', highlight: true },
  { page: 'history' as AppPage, label: 'Review History', icon: <HistoryIcon />, id: 'nav-history' },
  { page: 'compliance' as AppPage, label: 'Compliance', icon: <ShieldIcon />, id: 'nav-compliance' },
  { page: 'audit-log' as AppPage, label: 'Audit Log', icon: <AssignmentIcon />, id: 'nav-audit' },
];

const BOTTOM_ITEMS = [
  { page: 'help' as AppPage, label: 'Help & Docs', icon: <HelpOutlineIcon />, id: 'nav-help' },
  { page: 'settings' as AppPage, label: 'Settings', icon: <SettingsIcon />, id: 'nav-settings' },
];

export default function Sidebar({ currentPage, onNavigate, onLogout, userName, userRole, pendingCount = 0 }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const EXPANDED_W = 240;
  const COLLAPSED_W = 68;
  const W = collapsed ? COLLAPSED_W : EXPANDED_W;

  const NavItem = ({ page, label, icon, id, highlight = false }: any) => {
    const active = currentPage === page;
    return (
      <Tooltip title={collapsed ? label : ''} placement="right">
        <Box
          id={id}
          onClick={() => onNavigate(page)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: collapsed ? 0 : 1.5,
            px: collapsed ? 0 : 2,
            py: 1.2,
            mx: 1,
            mb: 0.5,
            borderRadius: 2,
            cursor: 'pointer',
            justifyContent: collapsed ? 'center' : 'flex-start',
            bgcolor: active
              ? 'rgba(59,130,246,0.18)'
              : highlight && !active
              ? 'rgba(16,185,129,0.08)'
              : 'transparent',
            border: active ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
            transition: 'all 0.18s',
            '&:hover': {
              bgcolor: active ? 'rgba(59,130,246,0.22)' : 'rgba(255,255,255,0.06)',
              transform: 'translateX(2px)',
            },
          }}
        >
          <Box sx={{
            color: active ? '#3B82F6' : highlight ? '#10B981' : '#94A3B8',
            display: 'flex',
            alignItems: 'center',
            minWidth: 24,
          }}>
            {icon}
          </Box>
          {!collapsed && (
            <Typography
              variant="body2"
              sx={{
                color: active ? '#E2E8F0' : '#94A3B8',
                fontWeight: active ? 700 : 500,
                fontSize: '0.875rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {label}
            </Typography>
          )}
          {!collapsed && active && (
            <Box
              sx={{
                ml: 'auto',
                width: 4,
                height: 4,
                borderRadius: '50%',
                bgcolor: '#3B82F6',
              }}
            />
          )}
        </Box>
      </Tooltip>
    );
  };

  return (
    <Box
      id="app-sidebar"
      sx={{
        width: W,
        minHeight: '100vh',
        bgcolor: 'rgba(10,17,32,0.97)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 1200,
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        backdropFilter: 'blur(20px)',
        boxShadow: '4px 0 24px rgba(0,0,0,0.4)',
      }}
    >
      {/* Logo Area */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          px: collapsed ? 1 : 2,
          py: 2,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          minHeight: 64,
        }}
      >
        {!collapsed && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecurityIcon sx={{ color: '#3B82F6', fontSize: 26 }} />
            <Box>
              <Typography sx={{ fontWeight: 800, color: 'white', fontSize: '1rem', lineHeight: 1.1 }}>
                NetConfig<span style={{ color: '#3B82F6' }}>AI</span>
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: '#475569', fontWeight: 600, letterSpacing: '0.08em' }}>
                ENTERPRISE
              </Typography>
            </Box>
          </Box>
        )}
        <IconButton
          onClick={() => setCollapsed(!collapsed)}
          size="small"
          id="sidebar-toggle"
          sx={{
            color: '#94A3B8',
            '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.08)' },
          }}
        >
          {collapsed ? <MenuIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Main Nav */}
      <Box sx={{ flex: 1, py: 2, overflow: 'hidden' }}>
        {!collapsed && (
          <Typography
            sx={{
              px: 3,
              mb: 1,
              fontSize: '0.65rem',
              color: '#334155',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Main Menu
          </Typography>
        )}
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.page} {...item} />
        ))}

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', my: 2, mx: 1 }} />

        {!collapsed && (
          <Typography
            sx={{
              px: 3,
              mb: 1,
              fontSize: '0.65rem',
              color: '#334155',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Support
          </Typography>
        )}
        {BOTTOM_ITEMS.map((item) => (
          <NavItem key={item.page} {...item} />
        ))}
      </Box>

      {/* Notification Badge (collapsed) */}
      {collapsed && pendingCount > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
          <Tooltip title={`${pendingCount} pending approvals`} placement="right">
            <Badge badgeContent={pendingCount} color="warning">
              <NotificationsIcon sx={{ color: '#94A3B8', fontSize: 20 }} />
            </Badge>
          </Tooltip>
        </Box>
      )}

      {/* User Profile Footer */}
      <Box
        sx={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          p: collapsed ? 1 : 2,
        }}
      >
        {collapsed ? (
          <Tooltip title={`${userName} — ${userRole}`} placement="right">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ bgcolor: '#3B82F6', width: 34, height: 34, fontSize: '0.85rem', fontWeight: 700 }}>
                {userName.charAt(0).toUpperCase()}
              </Avatar>
              <Tooltip title="Sign Out" placement="right">
                <IconButton
                  onClick={onLogout}
                  size="small"
                  sx={{ color: '#475569', '&:hover': { color: '#EF4444' } }}
                >
                  <LogoutIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Tooltip>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: '#3B82F6', width: 36, height: 36, fontWeight: 700, fontSize: '0.9rem' }}>
              {userName.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  color: '#E2E8F0',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {userName}
              </Typography>
              <Chip
                label={userRole.toUpperCase()}
                size="small"
                sx={{
                  bgcolor: 'rgba(59,130,246,0.12)',
                  color: '#3B82F6',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  height: 16,
                  mt: 0.3,
                }}
              />
            </Box>
            <Tooltip title="Sign Out">
              <IconButton
                onClick={onLogout}
                size="small"
                sx={{ color: '#475569', '&:hover': { color: '#EF4444', bgcolor: 'rgba(239,68,68,0.1)' } }}
              >
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Box>
  );
}
