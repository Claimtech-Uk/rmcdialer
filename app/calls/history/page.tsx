'use client'

import { CallHistoryTable } from '@/modules/calls'
import { api } from '@/lib/trpc/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card'
import { AlertCircle, BarChart3, Clock, Phone, TrendingUp } from 'lucide-react'

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="max-w-7xl mx-auto p-6">
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-red-600 p-4 rounded-lg bg-red-50 border border-red-200">
                <AlertCircle className="h-6 w-6" />
                <span className="font-medium">Failed to load call history: {error.message}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
              <Clock className="w-8 h-8 text-blue-600" />
              Call History
            </h1>
            <p className="text-slate-600 mt-2 text-lg">
              View and analyze your call performance and outcomes
            </p>
          </div>
        </div>

        {/* Call History Table Card */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Phone className="w-6 h-6 text-blue-600" />
              Recent Calls
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                  <p className="text-slate-600 text-lg">Loading call history...</p>
                </div>
              </div>
            ) : (
              <CallHistoryTable
                calls={callHistoryData?.calls || []}
                isLoading={isLoading}
                onRefresh={() => refetch()}
                showUserInfo={true}
              />
            )}
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {callHistoryData?.meta && callHistoryData.meta.total > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-white/20 backdrop-blur-sm">
                    <Phone className="h-8 w-8 text-white" />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm text-blue-100 mb-1">Total Calls</div>
                    <div className="text-3xl font-bold text-white">
                      {callHistoryData.meta.total}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-white/20 backdrop-blur-sm">
                    <BarChart3 className="h-8 w-8 text-white" />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm text-emerald-100 mb-1">Current Page</div>
                    <div className="text-3xl font-bold text-white">
                      {callHistoryData.meta.page}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-white/20 backdrop-blur-sm">
                    <TrendingUp className="h-8 w-8 text-white" />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm text-purple-100 mb-1">Total Pages</div>
                    <div className="text-3xl font-bold text-white">
                      {callHistoryData.meta.totalPages}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-500 to-red-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-white/20 backdrop-blur-sm">
                    <Clock className="h-8 w-8 text-white" />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm text-orange-100 mb-1">Showing</div>
                    <div className="text-3xl font-bold text-white">
                      {callHistoryData.calls.length}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Additional Information */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
            <CardTitle className="text-slate-800">Call History Features</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">Complete Call Records</h3>
                  <p className="text-sm text-slate-600">View detailed information about all your calls including duration and outcomes</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-100">
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">Performance Analytics</h3>
                  <p className="text-sm text-slate-600">Track your success rates, talk time, and call outcomes over time</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">Trend Analysis</h3>
                  <p className="text-sm text-slate-600">Identify patterns and improve your calling strategy with detailed insights</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 