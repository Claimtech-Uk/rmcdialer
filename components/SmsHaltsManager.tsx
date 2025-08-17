'use client'

import { useEffect, useState } from 'react'
import { Shield, ShieldX, Clock, RefreshCw, User, CheckSquare, Square, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card'
import { Button } from '@/modules/core/components/ui/button'
import { Badge } from '@/modules/core/components/ui/badge'
import { Input } from '@/modules/core/components/ui/input'
import { Alert, AlertDescription } from '@/modules/core/components/ui/alert'

interface SmsHalt {
  phoneNumber: string
  displayPhone: string
  haltKey: string
  expiresAt?: string
  timeRemaining?: string
  status: 'active' | 'expired'
}

interface Props {
  haltsData?: { success: boolean; halts: SmsHalt[]; count: number }
  isLoading: boolean
  onRefresh: () => void
  onClearHalts: (phones: string[]) => void
  clearingHalts: boolean
  selectedHalts: Set<string>
  onSelectedHaltsChange: (s: Set<string>) => void
}

export default function SmsHaltsManager({
  haltsData,
  isLoading,
  onRefresh,
  onClearHalts,
  clearingHalts,
  selectedHalts,
  onSelectedHaltsChange
}: Props) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('active')

  const halts = haltsData?.halts || []
  const activeHalts = halts.filter(h => h.status === 'active')
  const expiredHalts = halts.filter(h => h.status === 'expired')

  const filtered = halts.filter(h => {
    const matches = (h.displayPhone + h.phoneNumber).toLowerCase().includes(search.toLowerCase())
    const statusOk = filter === 'all' || h.status === filter
    return matches && statusOk
  })

  const [refreshCountdown, setRefreshCountdown] = useState(30)
  useEffect(() => {
    const t = setInterval(() => {
      setRefreshCountdown(prev => {
        if (prev <= 1) {
          onRefresh()
          return 30
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [onRefresh])

  const toggleSelect = (phone: string) => {
    const next = new Set(selectedHalts)
    if (next.has(phone)) next.delete(phone)
    else next.add(phone)
    onSelectedHaltsChange(next)
  }

  const selectAllFiltered = () => {
    const phones = filtered.filter(h => h.status === 'active').map(h => h.phoneNumber)
    if (phones.every(p => selectedHalts.has(p))) onSelectedHaltsChange(new Set())
    else onSelectedHaltsChange(new Set(phones))
  }

  const clearSelected = () => {
    if (selectedHalts.size > 0) onClearHalts(Array.from(selectedHalts))
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center p-6">
            <Shield className="h-8 w-8 text-red-500" />
            <div className="ml-4">
              <p className="text-2xl font-bold">{activeHalts.length}</p>
              <p className="text-sm text-slate-600">Active Blocks</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <Clock className="h-8 w-8 text-orange-500" />
            <div className="ml-4">
              <p className="text-2xl font-bold">{expiredHalts.length}</p>
              <p className="text-sm text-slate-600">Expired Blocks</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <RefreshCw className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-2xl font-bold">{refreshCountdown}s</p>
              <p className="text-sm text-slate-600">Next Refresh</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" /> Blocked Users
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
              {selectedHalts.size > 0 && (
                <Button variant="destructive" size="sm" onClick={clearSelected} disabled={clearingHalts}>
                  <ShieldX className="h-4 w-4 mr-2" /> Unblock ({selectedHalts.size})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Input placeholder="Search phone…" value={search} onChange={e => setSearch(e.target.value)} />
            <div className="flex gap-2">
              <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>All ({halts.length})</Button>
              <Button variant={filter === 'active' ? 'destructive' : 'outline'} size="sm" onClick={() => setFilter('active')}>Active ({activeHalts.length})</Button>
              <Button variant={filter === 'expired' ? 'secondary' : 'outline'} size="sm" onClick={() => setFilter('expired')}>Expired ({expiredHalts.length})</Button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <ShieldX className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <div className="text-slate-700 font-medium">No blocked users</div>
              <div className="text-slate-500 text-sm">{search ? 'Try a different search.' : 'Great news — no one is blocked right now.'}</div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 py-2 border-b">
                <Button variant="ghost" size="sm" onClick={selectAllFiltered}>
                  {filtered.filter(h => h.status === 'active').every(h => selectedHalts.has(h.phoneNumber)) ? (
                    <CheckSquare className="h-4 w-4 mr-2" />
                  ) : (
                    <Square className="h-4 w-4 mr-2" />
                  )}
                  Select All Active (filtered)
                </Button>
              </div>
              {filtered.map(h => (
                <div key={h.haltKey} className={`flex items-center justify-between p-4 border rounded-lg ${h.status === 'expired' ? 'bg-slate-50 border-slate-200' : 'bg-white border-red-200'}`}>
                  <div className="flex items-center gap-3">
                    {h.status === 'active' && (
                      <button onClick={() => toggleSelect(h.phoneNumber)} className="text-slate-400 hover:text-blue-500">
                        {selectedHalts.has(h.phoneNumber) ? <CheckSquare className="h-5 w-5 text-blue-600" /> : <Square className="h-5 w-5" />}
                      </button>
                    )}
                    <User className="h-4 w-4 text-slate-400" />
                    <span className="font-medium">{h.displayPhone}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={h.status === 'active' ? 'destructive' : 'secondary'} className="text-xs">
                      {h.status === 'active' ? (<><Shield className="h-3 w-3 mr-1" />Blocked • {h.timeRemaining || 'unknown'}</>) : (<><Clock className="h-3 w-3 mr-1" />Expired</>)}
                    </Badge>
                    {h.status === 'active' && (
                      <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => onClearHalts([h.phoneNumber])} disabled={clearingHalts}>
                        <ShieldX className="h-4 w-4 mr-1" /> Unblock
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Users may be blocked automatically for 24h after abusive content or STOP. You can manually unblock here.
        </AlertDescription>
      </Alert>
    </div>
  )
}


