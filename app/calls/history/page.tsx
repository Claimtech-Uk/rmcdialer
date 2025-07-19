'use client'

import { CallHistoryTable } from '@/modules/calls'
import { api } from '@/lib/trpc/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card'
import { AlertCircle } from 'lucide-react'

export default function CallHistoryPage() {
  const { 
    data: callHistoryData, 
    isLoading, 
    error, 
    refetch 
  } = api.calls.getCallHistoryTable.useQuery({
    page: 1,
    limit: 50
  })

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span>Failed to load call history: {error.message}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Call History</h1>
        <p className="text-gray-500 mt-2">
          View and analyze your call performance and outcomes
        </p>
      </div>

      <CallHistoryTable
        calls={callHistoryData?.calls || []}
        isLoading={isLoading}
        onRefresh={() => refetch()}
        showUserInfo={true}
      />

      {callHistoryData?.meta && callHistoryData.meta.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">
              Call History Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium">Total Calls</div>
                <div className="text-2xl font-bold text-blue-600">
                  {callHistoryData.meta.total}
                </div>
              </div>
              <div>
                <div className="font-medium">Current Page</div>
                <div className="text-2xl font-bold text-green-600">
                  {callHistoryData.meta.page}
                </div>
              </div>
              <div>
                <div className="font-medium">Total Pages</div>
                <div className="text-2xl font-bold text-purple-600">
                  {callHistoryData.meta.totalPages}
                </div>
              </div>
              <div>
                <div className="font-medium">Showing</div>
                <div className="text-2xl font-bold text-orange-600">
                  {callHistoryData.calls.length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 