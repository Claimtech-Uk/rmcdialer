import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider } from './components/AuthProvider';
import { useAuthStore } from './store/auth';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { QueuePage } from './pages/QueuePage';
import { CallPage } from './pages/CallPage';
import { DashboardPage } from './pages/DashboardPage';
import SMSPage from './pages/SMSPage';
import { MagicLinksPage } from './pages/MagicLinksPage';
import { ProfilePage } from './pages/ProfilePage';
import { CallHistoryPage } from './pages/CallHistoryPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on authentication errors
        if (error?.status === 401) return false;
        return failureCount < 3;
      },
    },
  },
});

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

// Public Route Component (redirect to dashboard if authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  
  if (isAuthenticated) {
    return <Navigate to="/queue" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } 
        />
        
        {/* Protected routes */}
        <Route 
          path="/*" 
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Navigate to="/queue" replace />} />
                  <Route path="/queue" element={<QueuePage />} />
                  <Route path="/call/:id" element={<CallPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/sms" element={<SMSPage />} />
                  <Route path="/magic-links" element={<MagicLinksPage />} />
                  <Route path="/calls" element={<CallHistoryPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App; 