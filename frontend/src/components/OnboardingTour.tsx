// @ts-nocheck
import { useState } from 'react';
import Joyride, { STATUS, ACTIONS, EVENTS } from 'react-joyride';

interface OnboardingTourProps {
  onComplete: () => void;
}

const tourSteps = [
  {
    target: '#app-sidebar',
    content: (
      <div>
        <h3 style={{ margin: '0 0 8px', color: '#E2E8F0', fontSize: '1rem' }}>👋 Welcome to NetConfigAI!</h3>
        <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.875rem', lineHeight: 1.6 }}>
          This is the <strong style={{ color: '#3B82F6' }}>Enterprise Sidebar</strong>. Use it to navigate between all pages of the platform. It collapses with the hamburger icon for more space.
        </p>
      </div>
    ),
    placement: 'right' as const,
    disableBeacon: true,
  },
  {
    target: '#nav-dashboard',
    content: (
      <div>
        <h3 style={{ margin: '0 0 8px', color: '#E2E8F0', fontSize: '1rem' }}>📊 Dashboard</h3>
        <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.875rem', lineHeight: 1.6 }}>
          Live stats overview showing total reviews, open reviews, high-risk findings, compliance violations, and pending approvals. Auto-refreshes every 30 seconds.
        </p>
      </div>
    ),
    placement: 'right' as const,
  },
  {
    target: '#nav-upload',
    content: (
      <div>
        <h3 style={{ margin: '0 0 8px', color: '#E2E8F0', fontSize: '1rem' }}>🚀 New Analysis</h3>
        <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.875rem', lineHeight: 1.6 }}>
          Upload your <strong style={{ color: '#10B981' }}>Old Configuration</strong> (baseline) and <strong style={{ color: '#3B82F6' }}>New Configuration</strong> (proposed changes). Select the config type and compliance frameworks, then submit for AI analysis.
        </p>
      </div>
    ),
    placement: 'right' as const,
  },
  {
    target: '#nav-history',
    content: (
      <div>
        <h3 style={{ margin: '0 0 8px', color: '#E2E8F0', fontSize: '1rem' }}>📜 Review History</h3>
        <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.875rem', lineHeight: 1.6 }}>
          Complete paginated list of all configuration reviews with filters for status, risk level, and search. Click any row to see full analysis details.
        </p>
      </div>
    ),
    placement: 'right' as const,
  },
  {
    target: '#nav-compliance',
    content: (
      <div>
        <h3 style={{ margin: '0 0 8px', color: '#E2E8F0', fontSize: '1rem' }}>🛡️ Compliance Overview</h3>
        <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.875rem', lineHeight: 1.6 }}>
          Aggregated compliance findings across all reviews. See overall pass rates for CIS, NIST, PCI-DSS, and SOC2 frameworks with detailed control-level findings.
        </p>
      </div>
    ),
    placement: 'right' as const,
  },
  {
    target: '#nav-audit',
    content: (
      <div>
        <h3 style={{ margin: '0 0 8px', color: '#E2E8F0', fontSize: '1rem' }}>📋 Audit Log</h3>
        <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.875rem', lineHeight: 1.6 }}>
          Enterprise immutable audit trail. Every approve, reject, escalate, login, and report download is recorded with timestamp, user, and role for compliance accountability.
        </p>
      </div>
    ),
    placement: 'right' as const,
  },
  {
    target: '#nav-help',
    content: (
      <div>
        <h3 style={{ margin: '0 0 8px', color: '#E2E8F0', fontSize: '1rem' }}>❓ Help & Documentation</h3>
        <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.875rem', lineHeight: 1.6 }}>
          Complete documentation, risk level guide, workflow steps, and FAQ. You can restart this tour anytime from the Help page!
        </p>
      </div>
    ),
    placement: 'right' as const,
  },
  {
    target: '#dashboard-new-analysis-btn',
    content: (
      <div>
        <h3 style={{ margin: '0 0 8px', color: '#E2E8F0', fontSize: '1rem' }}>✅ You're All Set!</h3>
        <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.875rem', lineHeight: 1.6 }}>
          Click <strong style={{ color: '#3B82F6' }}>New Analysis</strong> to upload your first configuration files and see the full AI-powered diff analysis in action!
        </p>
      </div>
    ),
    placement: 'bottom' as const,
  },
];

export default function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [run, setRun] = useState(true);

  const handleCallback = (data: any) => {
    const { status, action, type } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      onComplete();
    }
  };

  return (
    <Joyride
      steps={tourSteps}
      run={run}
      callback={handleCallback}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      disableOverlayClose={false}
      styles={{
        options: {
          arrowColor: '#1E293B',
          backgroundColor: '#1E293B',
          overlayColor: 'rgba(0, 0, 0, 0.7)',
          primaryColor: '#3B82F6',
          textColor: '#E2E8F0',
          zIndex: 9999,
        },
        tooltip: {
          borderRadius: 12,
          padding: 20,
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        },
        tooltipContainer: {
          textAlign: 'left' as const,
        },
        buttonNext: {
          backgroundColor: '#3B82F6',
          borderRadius: 8,
          fontWeight: 700,
          fontSize: '0.8rem',
          padding: '8px 16px',
        },
        buttonBack: {
          color: '#64748B',
          fontWeight: 600,
          fontSize: '0.8rem',
        },
        buttonSkip: {
          color: '#475569',
          fontSize: '0.75rem',
        },
        buttonClose: {
          color: '#64748B',
        },
        spotlight: {
          borderRadius: 8,
        },
        progress: {
          backgroundColor: '#3B82F6',
          height: 3,
          borderRadius: 3,
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: '🎉 Let\'s Go!',
        next: 'Next →',
        open: 'Open',
        skip: 'Skip Tour',
      }}
    />
  );
}
