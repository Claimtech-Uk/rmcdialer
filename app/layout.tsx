import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { TRPCProvider } from '@/lib/trpc/provider'
import { GlobalTwilioProvider } from '@/lib/providers/GlobalTwilioProvider'
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary'
import { LayoutManager } from '@/components/LayoutManager'
import { DebugOverlayFinder } from '@/components/DebugOverlayFinder'
import { AuthDiagnostic } from '@/components/AuthDiagnostic'

const inter = Inter({ subsets: ['latin'] })

// Force dynamic rendering for all pages - this is a dynamic dashboard app
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'RMC Call Centre',
  description: 'Advanced call centre management system',
}

// Simple Toaster component for now
function Toaster() {
  return <div id="toast-container" className="fixed top-4 right-4 z-50" />
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TRPCProvider>
          <GlobalErrorBoundary>
            <GlobalTwilioProvider>
              <LayoutManager>
                {children}
              </LayoutManager>
              {/* GlobalIncomingCallHandler disabled - using new CallSidebar in LayoutManager */}
              {/* FloatingCallStatus disabled - using new CallSidebar in LayoutManager */}
              {/* AudioUnlockHelper removed - now handled by AudioPermissionModal */}
              <DebugOverlayFinder />
              <AuthDiagnostic />
              <Toaster />
            </GlobalTwilioProvider>
          </GlobalErrorBoundary>
        </TRPCProvider>
      </body>
    </html>
  )
} 