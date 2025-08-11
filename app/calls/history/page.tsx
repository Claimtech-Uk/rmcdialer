'use client'

import { useMemo, useState } from 'react'
import { CallHistoryTable } from '@/modules/calls/components/CallHistoryTable'
import { api } from '@/lib/trpc/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card'
import { Button } from '@/modules/core/components/ui/button'
import { AlertCircle, BarChart3, Clock, Phone, TrendingUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { DateRangePicker } from '@/modules/core/components/ui/date-range-picker'

export default function CallHistoryPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [selectedOutcome, setSelectedOutcome] = useState<string | undefined>(undefined)
  const [selectedAgentId, setSelectedAgentId] = useState<number | undefined>(undefined)
  const [customRange, setCustomRange] = useState<{ startDate: Date; endDate: Date} | null>(null)
  const [missedOnly, setMissedOnly] = useState(false)

  const { 
    data: callHistoryData, 
    isLoading, 
    error, 
    refetch 
  } = api.calls.getCallHistoryTable.useQuery({
    page: currentPage,
    limit: pageSize,
    ...(selectedAgentId && { agentId: selectedAgentId }),
    ...(selectedOutcome && { outcome: selectedOutcome }),
    ...(missedOnly && { status: 'missed_call' as any }),
    ...(customRange ? { startDate: customRange.startDate, endDate: customRange.endDate } : undefined)
  })

  // Agents list for filter dropdown
  const { data: agentsData } = api.auth.getAllAgents.useQuery({ page: 1, limit: 200, isActive: true }, { retry: 1, refetchOnWindowFocus: false })
  const { data: me } = api.auth.me.useQuery(undefined, { retry: 1, refetchOnWindowFocus: false })
  const agents = useMemo(() => {
    if (agentsData?.agents?.length) return agentsData.agents
    if (me?.agent) return [me.agent]
    return []
  }, [agentsData, me])

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
          <CardContent className="p-0 relative">
            {/* Server-driven Filters */}
            <div className="p-4 flex flex-wrap items-center gap-3 border-b bg-white/60">
              {/* Quick toggles */}
              <div className="flex gap-2 mr-2">
                <Button
                  variant={missedOnly ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => { setMissedOnly(false); setCurrentPage(1) }}
                >
                  All Calls
                </Button>
                <Button
                  variant={missedOnly ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setMissedOnly(true); setCurrentPage(1) }}
                >
                  Inbound Missed
                </Button>
              </div>
              {/* Outcome */}
              <select
                value={selectedOutcome || ''}
                onChange={(e) => { setSelectedOutcome(e.target.value || undefined); setCurrentPage(1) }}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="">All Outcomes</option>
                <option value="completed_form">Completed Form</option>
                <option value="going_to_complete">Going to Complete</option>
                <option value="might_complete">Might Complete</option>
                <option value="call_back">Callback Requested</option>
                <option value="no_answer">No Answer</option>
                <option value="missed_call">Missed Call</option>
                <option value="hung_up">Hung Up</option>
                <option value="bad_number">Bad Number</option>
                <option value="no_claim">No Claim</option>
                <option value="not_interested">Not Interested</option>
                <option value="do_not_contact">Do Not Contact</option>
              </select>

              {/* Custom date-time range */}
              <DateRangePicker
                value={customRange ?? { startDate: new Date(Date.now() - 7*24*60*60*1000), endDate: new Date() }}
                onChange={(range) => { setCustomRange(range); setCurrentPage(1) }}
                className="ml-2"
              />

              {/* Fine time controls for quick tweaks */}
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>Time:</span>
                <input
                  type="datetime-local"
                  className="border rounded px-1 py-0.5"
                  value={customRange ? new Date(customRange.startDate.getTime() - customRange.startDate.getTimezoneOffset()*60000).toISOString().slice(0,16) : ''}
                  onChange={(e) => {
                    const val = e.target.value
                    if (!val) return
                    const dt = new Date(val)
                    const end = customRange?.endDate ?? new Date()
                    setCustomRange({ startDate: dt, endDate: end })
                    setCurrentPage(1)
                  }}
                  placeholder="Start"
                />
                <span>–</span>
                <input
                  type="datetime-local"
                  className="border rounded px-1 py-0.5"
                  value={customRange ? new Date(customRange.endDate.getTime() - customRange.endDate.getTimezoneOffset()*60000).toISOString().slice(0,16) : ''}
                  onChange={(e) => {
                    const val = e.target.value
                    if (!val) return
                    const dt = new Date(val)
                    const start = customRange?.startDate ?? new Date(Date.now() - 24*60*60*1000)
                    setCustomRange({ startDate: start, endDate: dt })
                    setCurrentPage(1)
                  }}
                  placeholder="End"
                />
              </div>

              {/* Agent */}
              <div className="relative">
                <select
                  value={selectedAgentId ? String(selectedAgentId) : ''}
                  onChange={(e) => { setSelectedAgentId(e.target.value ? Number(e.target.value) : undefined); setCurrentPage(1) }}
                  className="border rounded px-2 py-1 text-sm pr-7"
                >
                  <option value="">All Agents</option>
                  {agents.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                  ))}
                </select>
                {selectedAgentId !== undefined && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute right-[-52px] top-0 h-[30px]"
                    onClick={() => { setSelectedAgentId(undefined); setCurrentPage(1) }}
                  >
                    ×
                  </Button>
                )}
              </div>

              <Button variant="outline" size="sm" onClick={() => { setSelectedOutcome(undefined); setSelectedAgentId(undefined); setCustomRange(null); setCurrentPage(1) }}>Clear</Button>
              <div className="ml-auto" />
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                  <p className="text-slate-600 text-lg">Loading call history...</p>
                </div>
              </div>
            ) : (
              <>
                <CallHistoryTable
                  calls={callHistoryData?.calls || []}
                  isLoading={isLoading}
                  onRefresh={() => refetch()}
                  showUserInfo={true}
                  enableLocalFilters={false}
                />
                {isLoading && (
                  <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10">
                    <div className="text-center">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-slate-600 text-sm">Loading page {currentPage}...</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Pagination Controls */}
        {callHistoryData?.meta && callHistoryData.meta.totalPages > 1 && (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Results Info */}
                <div className="text-sm text-slate-600">
                  Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * pageSize, callHistoryData.meta.total)}
                  </span>{' '}
                  of <span className="font-medium">{callHistoryData.meta.total}</span> calls
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center gap-2">
                  {/* First Page */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1 || isLoading}
                    className="p-2"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>

                  {/* Previous Page */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || isLoading}
                    className="p-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, callHistoryData.meta.totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (callHistoryData.meta.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= callHistoryData.meta.totalPages - 2) {
                        pageNum = callHistoryData.meta.totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={pageNum === currentPage ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          disabled={isLoading}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  {/* Next Page */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(callHistoryData.meta.totalPages, prev + 1))}
                    disabled={currentPage === callHistoryData.meta.totalPages || isLoading}
                    className="p-2"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>

                  {/* Last Page */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(callHistoryData.meta.totalPages)}
                    disabled={currentPage === callHistoryData.meta.totalPages || isLoading}
                    className="p-2"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Page Size Selector */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-600">Show:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setCurrentPage(1) // Reset to first page when changing page size
                    }}
                    disabled={isLoading}
                    className="px-2 py-1 border border-slate-300 rounded bg-white text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                  <span className="text-slate-600">per page</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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