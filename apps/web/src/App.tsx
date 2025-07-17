import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { LoginPage } from './pages/LoginPage';
import { QueuePage } from './pages/QueuePage';
import { CallPage } from './pages/CallPage';
import { DashboardPage } from './pages/DashboardPage';
import { SMSPage } from './pages/SMSPage';
import { Layout } from './components/Layout';

function App() {
  const { agent, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Layout>
        <Routes>
          {/* Agent Routes */}
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/call/:sessionId" element={<CallPage />} />
          <Route path="/sms" element={<SMSPage />} />
          
          {/* Supervisor Routes */}
          {(agent?.role === 'supervisor' || agent?.role === 'admin') && (
            <Route path="/dashboard" element={<DashboardPage />} />
          )}
          
          {/* Default redirects */}
          <Route path="/" element={<Navigate to="/queue" replace />} />
          <Route path="/login" element={<Navigate to="/queue" replace />} />
          <Route path="*" element={<Navigate to="/queue" replace />} />
        </Routes>
      </Layout>
    </div>
  );
}

export default App; 