'use client';

import { useState } from 'react';
import { TeamConfig } from '@/lib/config/teams';
import { RefreshCw, Coffee, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface EmptyQueueStateProps {
  teamConfig: TeamConfig;
  onRefresh: () => void;
  isLoading?: boolean;
  lastRefreshTime?: Date;
  queueStats?: {
    totalProcessedToday?: number;
    lastUserProcessedAt?: Date;
    avgProcessingTime?: number;
  };
}

export function EmptyQueueState({
  teamConfig,
  onRefresh,
  isLoading = false,
  lastRefreshTime,
  queueStats
}: EmptyQueueStateProps) {
  const [refreshCount, setRefreshCount] = useState(0);

  const handleRefresh = () => {
    setRefreshCount(prev => prev + 1);
    onRefresh();
  };

  const getTeamSpecificMessage = () => {
    switch (teamConfig.team) {
      case 'unsigned':
        return {
          title: "All Signatures Collected! 🎉",
          subtitle: "No users currently need signature collection",
          description: "Great work! All users in the system have provided their digital signatures. New unsigned users will appear here automatically when they submit claims.",
          suggestion: "Take a well-deserved break or help the Requirements team with document collection."
        };
      case 'requirements':
        return {
          title: "All Requirements Complete! 📋",
          subtitle: "No users currently have pending document requirements",
          description: "Excellent! All users have submitted their required documents. The system will automatically add new users here when they have pending requirements.",
          suggestion: "Consider helping with signature collection or taking a break until new requirements come in."
        };
      default:
        return {
          title: "Queue Empty",
          subtitle: "No users currently in queue",
          description: "All users have been processed successfully.",
          suggestion: "Check back later for new users."
        };
    }
  };

  const message = getTeamSpecificMessage();

  const formatLastRefresh = () => {
    if (!lastRefreshTime) return 'Never';
    const now = new Date();
    const diff = now.getTime() - lastRefreshTime.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s ago`;
    }
    return `${seconds}s ago`;
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className={`p-6 ${teamConfig.color.gradient} text-white text-center`}>
          <div className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">{message.title}</h2>
          <p className="text-white/90">{message.subtitle}</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Main Message */}
          <div className="text-center mb-6">
            <p className="text-slate-600 text-lg leading-relaxed mb-4">
              {message.description}
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-800 rounded-lg text-sm">
              <CheckCircle className="w-4 h-4" />
              <span className="font-medium">{teamConfig.displayName} - All Clear!</span>
            </div>
          </div>

          {/* Stats Cards */}
          {queueStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-slate-800">
                  {queueStats.totalProcessedToday || 0}
                </div>
                <div className="text-sm text-slate-600">Completed Today</div>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-slate-800">
                  {queueStats.avgProcessingTime ? `${Math.round(queueStats.avgProcessingTime)}m` : '—'}
                </div>
                <div className="text-sm text-slate-600">Avg Call Time</div>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-slate-800">
                  {queueStats.lastUserProcessedAt ? 
                    new Date(queueStats.lastUserProcessedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                    '—'
                  }
                </div>
                <div className="text-sm text-slate-600">Last Completed</div>
              </div>
            </div>
          )}

          {/* Suggestion Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Coffee className="w-3 h-3 text-white" />
              </div>
              <div>
                <h4 className="font-medium text-blue-900 mb-1">What's Next?</h4>
                <p className="text-blue-800 text-sm leading-relaxed">
                  {message.suggestion}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:opacity-50 ${teamConfig.color.gradient} text-white shadow-lg hover:shadow-xl`}
            >
              <RefreshCw className={`w-4 h-4 mr-2 inline ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Checking...' : 'Check for New Users'}
            </button>
            
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="px-6 py-3 rounded-lg font-medium transition-colors bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              Return to Dashboard
            </button>
          </div>

          {/* Refresh Info */}
          <div className="mt-6 pt-4 border-t border-slate-200 text-center">
            <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Last checked: {formatLastRefresh()}</span>
              </div>
              
              {refreshCount > 0 && (
                <div className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>Refreshed {refreshCount} time{refreshCount !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
            
            <p className="text-xs text-slate-400 mt-2">
              The system automatically checks for new users every 30 seconds
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 