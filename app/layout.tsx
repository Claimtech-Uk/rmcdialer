import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { TRPCProvider } from '@/lib/trpc/provider'
import { GlobalTwilioProvider } from '@/lib/providers/GlobalTwilioProvider'
import { GlobalIncomingCallHandler } from '@/components/GlobalIncomingCallHandler'
import { FloatingCallStatus } from '@/components/FloatingCallStatus'
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary'
import { AudioUnlockHelper } from '@/components/AudioUnlockHelper'

const inter = Inter({ subsets: ['latin'] })

// Force dynamic rendering for all pages - this is a dynamic dashboard app
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'RMC Dialler System',
  description: 'Professional dialler system for claims management',
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
              {children}
              <GlobalErrorBoundary>
                <GlobalIncomingCallHandler />
              </GlobalErrorBoundary>
              <GlobalErrorBoundary>
                <FloatingCallStatus />
              </GlobalErrorBoundary>
              <GlobalErrorBoundary>
                <AudioUnlockHelper />
              </GlobalErrorBoundary>
              <Toaster />
            </GlobalTwilioProvider>
          </GlobalErrorBoundary>
        </TRPCProvider>
      </body>
    </html>
  )
} 