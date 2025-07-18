// =============================================================================
// Dashboard Layout - Next.js App Router
// =============================================================================
// Protected layout with navigation for all dashboard pages

import DashboardClientLayout from './client-layout'

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return <DashboardClientLayout>{children}</DashboardClientLayout>
} 