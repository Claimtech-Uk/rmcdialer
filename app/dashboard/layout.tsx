'use client';

import Sidebar from '@/modules/core/components/ui/sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <Sidebar>
      {children}
    </Sidebar>
  );
} 