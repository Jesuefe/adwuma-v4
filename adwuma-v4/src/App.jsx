import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider } from './context/AuthContext';
import { RoleRoute, PublicOnlyRoute } from './components/shared/RouteGuards';
import PlaceholderPage from './pages/PlaceholderPage';

// Public
import HomePage from './pages/HomePage';
import JobsPage from './pages/JobsPage';
import JobDetailPage from './pages/JobDetailPage';

// Auth
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// Seeker
import SeekerDashboard from './pages/seeker/DashboardPage';
import SeekerApplications from './pages/seeker/ApplicationsPage';
import SeekerApplicationDetail from './pages/seeker/ApplicationDetailPage';
import SeekerProfile from './pages/seeker/ProfilePage';
import SeekerInbox from './pages/seeker/InboxPage';

// Agent
import AgentDashboard from './pages/agent/DashboardPage';
import AgentKYCPage from './pages/agent/KYCPage';
import AgentWalletPage from './pages/agent/WalletPage';
import AgentJobsPage from './pages/agent/JobsPage';
import AgentPostJobPage from './pages/agent/PostJobPage';
import AgentApplicationsPage from './pages/agent/ApplicationsPage';
import AgentApplicationDetail from './pages/agent/ApplicationDetailPage';
import AgentProfile from './pages/agent/ProfilePage';
import AgentInbox from './pages/agent/InboxPage';

// Admin
import AdminDashboard from './pages/admin/DashboardPage';
import AdminKYCQueue from './pages/admin/KYCQueuePage';
import AdminJobsQueue from './pages/admin/JobsQueuePage';
import AdminDocuments from './pages/admin/DocumentsQueuePage';
import AdminPayments from './pages/admin/PaymentsPage';
import AdminWithdrawals from './pages/admin/WithdrawalsPage';
import AdminUsers from './pages/admin/UsersPage';
import AdminSettings from './pages/admin/SettingsPage';
import AdminInbox from './pages/admin/InboxPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 2, retry: 1, refetchOnWindowFocus: false } },
});

function PageLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#05080f' }}>
      <div style={{ width: 32, height: 32, border: '3px solid rgba(245,158,11,0.2)', borderTop: '3px solid #f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public */}
              <Route path="/" element={<HomePage />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/jobs/:jobId" element={<JobDetailPage />} />
              <Route path="/suspended" element={<PlaceholderPage title="Account Suspended" />} />

              {/* Auth */}
              <Route path="/auth/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
              <Route path="/auth/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
              <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

              {/* Seeker */}
              <Route path="/dashboard" element={<RoleRoute role="seeker"><SeekerDashboard /></RoleRoute>} />
              <Route path="/dashboard/applications" element={<RoleRoute role="seeker"><SeekerApplications /></RoleRoute>} />
              <Route path="/dashboard/applications/:applicationId" element={<RoleRoute role="seeker"><SeekerApplicationDetail /></RoleRoute>} />
              <Route path="/dashboard/inbox" element={<RoleRoute role="seeker"><SeekerInbox /></RoleRoute>} />
              <Route path="/dashboard/profile" element={<RoleRoute role="seeker"><SeekerProfile /></RoleRoute>} />

              {/* Agent */}
              <Route path="/agent" element={<RoleRoute role="agent"><AgentDashboard /></RoleRoute>} />
              <Route path="/agent/kyc" element={<RoleRoute role="agent"><AgentKYCPage /></RoleRoute>} />
              <Route path="/agent/jobs" element={<RoleRoute role="agent"><AgentJobsPage /></RoleRoute>} />
              <Route path="/agent/jobs/new" element={<RoleRoute role="agent"><AgentPostJobPage /></RoleRoute>} />
              <Route path="/agent/jobs/:jobId/edit" element={<RoleRoute role="agent"><AgentPostJobPage /></RoleRoute>} />
              <Route path="/agent/applications" element={<RoleRoute role="agent"><AgentApplicationsPage /></RoleRoute>} />
              <Route path="/agent/applications/:applicationId" element={<RoleRoute role="agent"><AgentApplicationDetail /></RoleRoute>} />
              <Route path="/agent/wallet" element={<RoleRoute role="agent"><AgentWalletPage /></RoleRoute>} />
              <Route path="/agent/inbox" element={<RoleRoute role="agent"><AgentInbox /></RoleRoute>} />
              <Route path="/agent/profile" element={<RoleRoute role="agent"><AgentProfile /></RoleRoute>} />

              {/* Admin */}
              <Route path="/admin" element={<RoleRoute role="admin"><AdminDashboard /></RoleRoute>} />
              <Route path="/admin/kyc" element={<RoleRoute role="admin"><AdminKYCQueue /></RoleRoute>} />
              <Route path="/admin/jobs" element={<RoleRoute role="admin"><AdminJobsQueue /></RoleRoute>} />
              <Route path="/admin/documents" element={<RoleRoute role="admin"><AdminDocuments /></RoleRoute>} />
              <Route path="/admin/payments" element={<RoleRoute role="admin"><AdminPayments /></RoleRoute>} />
              <Route path="/admin/withdrawals" element={<RoleRoute role="admin"><AdminWithdrawals /></RoleRoute>} />
              <Route path="/admin/users" element={<RoleRoute role="admin"><AdminUsers /></RoleRoute>} />
              <Route path="/admin/settings" element={<RoleRoute role="admin"><AdminSettings /></RoleRoute>} />
              <Route path="/admin/inbox" element={<RoleRoute role="admin"><AdminInbox /></RoleRoute>} />

              <Route path="*" element={<PlaceholderPage title="404 — Page Not Found" />} />
            </Routes>
          </Suspense>
          <ToastContainer position="top-right" autoClose={4000} theme="dark" />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
