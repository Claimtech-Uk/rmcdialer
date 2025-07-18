import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { TRPCProvider } from '@/lib/trpc/provider'

const inter = Inter({ subsets: ['latin'] })

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
          {children}
          <Toaster />
        </TRPCProvider>
      </body>
    </html>
  )
} 