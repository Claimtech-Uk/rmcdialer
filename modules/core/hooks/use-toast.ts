import { useState, useCallback } from 'react'

interface ToastOptions {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

interface Toast extends ToastOptions {
  id: string
}

let toastId = 0

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback(({ title, description, variant = 'default' }: ToastOptions) => {
    const id = (++toastId).toString()
    const newToast: Toast = { id, title, description, variant }
    
    setToasts(prev => [...prev, newToast])
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
    
    return { id }
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return {
    toasts,
    toast,
    dismiss
  }
} 