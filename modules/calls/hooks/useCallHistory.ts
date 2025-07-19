'use client'

import { useState, useCallback } from 'react'
import { api } from '@/lib/trpc/client'

interface UseCallHistoryOptions {
  initialPage?: number
  initialLimit?: number
  agentId?: number
  userId?: number
  autoRefresh?: boolean
  refreshInterval?: number
}

interface CallHistoryFilters {
  page: number
  limit: number
  agentId?: number
  userId?: number
  startDate?: Date
  endDate?: Date
  outcome?: string
  status?: string
}

export function useCallHistory(options: UseCallHistoryOptions = {}) {
  const {
    initialPage = 1,
    initialLimit = 20,
    agentId,
    userId,
    autoRefresh = false,
    refreshInterval = 30000
  } = options

  const [filters, setFilters] = useState<CallHistoryFilters>({
    page: initialPage,
    limit: initialLimit,
    agentId,
    userId
  })

  const {
    data: callHistoryData,
    isLoading,
    error,
    refetch
  } = api.calls.getCallHistoryTable.useQuery(filters, {
    refetchInterval: autoRefresh ? refreshInterval : false,
    keepPreviousData: true
  })

  const updateFilters = useCallback((newFilters: Partial<CallHistoryFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      // Reset to page 1 when filters change (except for page changes)
      page: newFilters.page !== undefined ? newFilters.page : 1
    }))
  }, [])

  const nextPage = useCallback(() => {
    if (callHistoryData?.meta && filters.page < callHistoryData.meta.totalPages) {
      updateFilters({ page: filters.page + 1 })
    }
  }, [callHistoryData?.meta, filters.page, updateFilters])

  const previousPage = useCallback(() => {
    if (filters.page > 1) {
      updateFilters({ page: filters.page - 1 })
    }
  }, [filters.page, updateFilters])

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && (!callHistoryData?.meta || page <= callHistoryData.meta.totalPages)) {
      updateFilters({ page })
    }
  }, [callHistoryData?.meta, updateFilters])

  const setPageSize = useCallback((limit: number) => {
    updateFilters({ limit, page: 1 })
  }, [updateFilters])

  const setDateRange = useCallback((startDate?: Date, endDate?: Date) => {
    updateFilters({ startDate, endDate })
  }, [updateFilters])

  const setOutcomeFilter = useCallback((outcome?: string) => {
    updateFilters({ outcome })
  }, [updateFilters])

  const setStatusFilter = useCallback((status?: string) => {
    updateFilters({ status })
  }, [updateFilters])

  const clearFilters = useCallback(() => {
    setFilters({
      page: 1,
      limit: initialLimit,
      agentId,
      userId
    })
  }, [initialLimit, agentId, userId])

  return {
    // Data
    calls: callHistoryData?.calls || [],
    meta: callHistoryData?.meta || {
      page: 1,
      limit: initialLimit,
      total: 0,
      totalPages: 0
    },
    
    // Loading states
    isLoading,
    error,
    
    // Current filters
    filters,
    
    // Actions
    refetch,
    updateFilters,
    
    // Pagination
    nextPage,
    previousPage,
    goToPage,
    setPageSize,
    
    // Filtering
    setDateRange,
    setOutcomeFilter,
    setStatusFilter,
    clearFilters,
    
    // Computed properties
    hasNextPage: callHistoryData?.meta ? filters.page < callHistoryData.meta.totalPages : false,
    hasPreviousPage: filters.page > 1,
    isFirstPage: filters.page === 1,
    isLastPage: callHistoryData?.meta ? filters.page >= callHistoryData.meta.totalPages : true,
    totalItems: callHistoryData?.meta?.total || 0,
    currentPageSize: callHistoryData?.calls?.length || 0
  }
} 