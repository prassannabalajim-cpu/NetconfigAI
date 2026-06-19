// @ts-nocheck
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from './theme';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import NetworkBackground from './components/NetworkBackground';
import AuthPage from './components/AuthPage';
import Sidebar, { AppPage } from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import UploadPage from './components/UploadPage';
import HistoryPage from './components/HistoryPage';
import ReviewDetailPage from './components/ReviewDetailPage';
import CompliancePage from './components/CompliancePage';
import AuditLogPage from './components/AuditLogPage';
import HelpPage from './components/HelpPage';
import SettingsPage from './components/SettingsPage';
import OnboardingTour from './components/OnboardingTour';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const getParsedToken = () => {
  try {
    const token = sessionStorage.getItem('token');
    if (!token) return null;
    return JSON.parse(atob(token.split('.')[1]));
  } catch { return null; }
};

const SIDEBAR_EXPANDED = 240;
const SIDEBAR_COLLAPSED = 68;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState<AppPage>('dashboard');
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const [sidebarCollapsed] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [stats, setStats] = useState({ pending_approvals: 0 });
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const raw = sessionStorage.getItem('current_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;
  const tokenParsed = getParsedToken();
  const userName = currentUser?.full_name || 'Enterprise User';
  const userRole = currentUser?.role || tokenParsed?.role || 'network_engineer';

  const persistAuth = (authData: any) => {
    const accessToken = authData?.access_token || authData;
    if (!accessToken) return;
    sessionStorage.setItem('token', accessToken);
    localStorage.removeItem('token');
    if (authData?.refresh_token) sessionStorage.setItem('refresh_token', authData.refresh_token);
    localStorage.removeItem('refresh_token');
    if (authData?.user) {
      sessionStorage.setItem('current_user', JSON.stringify(authData.user));
      localStorage.removeItem('current_user');
      setCurrentUser(authData.user);
    }
  };

  const consumeOAuthRedirect = () => {
    const fragment = window.location.hash?.startsWith('#') ? window.location.hash.slice(1) : '';
    if (!fragment) return false;

    const params = new URLSearchParams(fragment);
    if (params.get('oauth') !== 'google' || !params.get('access_token')) return false;

    sessionStorage.setItem('token', params.get('access_token') || '');
    const refreshToken = params.get('refresh_token');
    if (refreshToken) sessionStorage.setItem('refresh_token', refreshToken);
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
    return true;
  };

  const clearAuth = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('current_user');
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('current_user');
    setCurrentUser(null);
    setIsAuthenticated(false);
    setCurrentPage('dashboard');
    setActiveReviewId(null);
  };

  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use((config) => {
      const token = sessionStorage.getItem('token');
      if (token && !config.headers?.Authorization) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const original = error.config || {};
        const refreshToken = sessionStorage.getItem('refresh_token');
        const isRefreshCall = original.url?.includes('/api/v1/auth/refresh');
        if (error.response?.status === 401 && refreshToken && !original._retry && !isRefreshCall) {
          original._retry = true;
          try {
            const refreshRes = await axios.post(`${API_BASE}/api/v1/auth/refresh`, { refresh_token: refreshToken });
            persistAuth(refreshRes.data);
            original.headers = original.headers || {};
            original.headers.Authorization = `Bearer ${refreshRes.data.access_token}`;
            return axios(original);
          } catch {
            clearAuth();
          }
        } else if (error.response?.status === 401) {
          clearAuth();
        }
        return Promise.reject(error);
      }
    );

    const hydrateSession = async () => {
      consumeOAuthRedirect();
      const legacyToken = localStorage.getItem('token');
      const legacyRefresh = localStorage.getItem('refresh_token');
      const legacyUser = localStorage.getItem('current_user');
      if (!sessionStorage.getItem('token') && legacyToken) sessionStorage.setItem('token', legacyToken);
      if (!sessionStorage.getItem('refresh_token') && legacyRefresh) sessionStorage.setItem('refresh_token', legacyRefresh);
      if (!sessionStorage.getItem('current_user') && legacyUser) sessionStorage.setItem('current_user', legacyUser);
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('current_user');

      const token = sessionStorage.getItem('token');
      if (!token) return;
      setIsAuthenticated(true);
      try {
        const meRes = await axios.get(`${API_BASE}/api/v1/auth/me`);
        sessionStorage.setItem('current_user', JSON.stringify(meRes.data));
        setCurrentUser(meRes.data);
        const tourDone = localStorage.getItem('tour_completed');
        if (!tourDone) setTimeout(() => setShowTour(true), 1500);
      } catch {}
    };
    hydrateSession();

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/v1/dashboard`);
        setStats(res.data);
      } catch {}
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleLogin = (authData: any) => {
    persistAuth(authData);
    setIsAuthenticated(true);
    const tourDone = localStorage.getItem('tour_completed');
    if (!tourDone) setTimeout(() => setShowTour(true), 1500);
  };

  const handleLogout = async () => {
    try {
      const token = sessionStorage.getItem('token');
      if (token) await axios.post(`${API_BASE}/api/v1/auth/logout`);
    } catch {}
    clearAuth();
  };

  const navigateToReview = (reviewId: string) => {
    setActiveReviewId(reviewId);
    setCurrentPage('review-detail');
  };

  const handleNavigate = (page: AppPage) => {
    if (page !== 'review-detail') setActiveReviewId(null);
    setCurrentPage(page);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onViewReview={navigateToReview} onNavigate={handleNavigate} />;
      case 'upload':
        return <UploadPage onViewReview={navigateToReview} onBack={() => handleNavigate('dashboard')} />;
      case 'history':
        return <HistoryPage onBack={() => handleNavigate('dashboard')} onViewReview={navigateToReview} />;
      case 'review-detail':
        return activeReviewId
          ? <ReviewDetailPage reviewId={activeReviewId} onBack={() => handleNavigate('history')} />
          : null;
      case 'compliance':
        return <CompliancePage onViewReview={navigateToReview} />;
      case 'audit-log':
        return <AuditLogPage />;
      case 'help':
        return <HelpPage onStartTour={() => setShowTour(true)} />;
      case 'settings':
        return <SettingsPage user={currentUser} onUserUpdate={(user: any) => {
          setCurrentUser(user);
          if (user) sessionStorage.setItem('current_user', JSON.stringify(user));
        }} />;
      default:
        return <Dashboard onViewReview={navigateToReview} onNavigate={handleNavigate} />;
    }
  };

  if (!isAuthenticated) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <NetworkBackground />
        <AuthPage onLogin={handleLogin} />
        <ToastContainer position="bottom-right" theme="dark" />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NetworkBackground />

      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        userName={userName}
        userRole={userRole}
        pendingCount={stats.pending_approvals}
      />

      <TopBar
        currentPage={currentPage}
        pendingCount={stats.pending_approvals}
        sidebarWidth={sidebarWidth}
        onRefresh={currentPage === 'dashboard' ? undefined : undefined}
      />

      <Box
        sx={{
          ml: `${sidebarWidth}px`,
          mt: '64px',
          minHeight: 'calc(100vh - 64px)',
          transition: 'margin-left 0.25s cubic-bezier(0.4,0,0.2,1)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {renderPage()}
      </Box>

      {showTour && (
        <OnboardingTour
          onComplete={() => {
            setShowTour(false);
            localStorage.setItem('tour_completed', 'true');
          }}
        />
      )}

      <ToastContainer position="bottom-right" theme="dark" />
    </ThemeProvider>
  );
}

export default App;
