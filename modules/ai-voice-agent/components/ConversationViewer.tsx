// Conversation Viewer Component
// Detailed view of individual voice conversations with transcript and analysis

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  Pause, 
  Download, 
  MessageSquare, 
  User, 
  Bot, 
  Clock,
  Phone,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { VoiceConversation, ConversationTurn, ConversationOutcome } from '../types/ai-voice.types';

interface ConversationViewerProps {
  conversation: VoiceConversation;
  onClose?: () => void;
}

export function ConversationViewer({ conversation, onClose }: ConversationViewerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTurn, setCurrentTurn] = useState(0);

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(timestamp);
  };

  const formatDuration = (startTime: Date, endTime?: Date) => {
    const end = endTime || new Date();
    const duration = Math.floor((end.getTime() - startTime.getTime()) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getOutcomeColor = (outcome?: ConversationOutcome) => {
    if (!outcome) return 'bg-gray-500';
    switch (outcome.type) {
      case 'resolved': return 'bg-green-500';
      case 'transferred': return 'bg-orange-500';
      case 'escalated': return 'bg-red-500';
      case 'abandoned': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600';
      case 'negative': return 'text-red-600';
      case 'neutral': return 'text-gray-600';
      default: return 'text-gray-500';
    }
  };

  const playAudio = () => {
    if (conversation.recordingUrl) {
      // In real implementation, this would control audio playback
      setIsPlaying(!isPlaying);
    }
  };

  const downloadTranscript = () => {
    const transcript = conversation.turns?.map(turn => 
      `[${formatTimestamp(turn.timestamp)}] ${turn.speaker === 'user' ? 'Caller' : 'Agent'}: ${turn.text}`
    ).join('\n') || '';
    
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${conversation.id}-transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Conversation {conversation.id}
              </CardTitle>
              <div className="flex items-center gap-4 mt-2">
                <div className="text-sm text-muted-foreground">
                  <strong>Caller:</strong> {conversation.callerInfo?.name || 'Unknown'}
                </div>
                <div className="text-sm text-muted-foreground">
                  <strong>Phone:</strong> {conversation.callerInfo?.phone || 'N/A'}
                </div>
                <div className="text-sm text-muted-foreground">
                  <strong>Duration:</strong> {formatDuration(conversation.startedAt, conversation.endedAt)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`${getOutcomeColor(conversation.outcome)} text-white`}>
                {conversation.outcome?.type || conversation.status}
              </Badge>
              {onClose && (
                <Button variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {conversation.recordingUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={playAudio}
                  className="flex items-center gap-2"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {isPlaying ? 'Pause' : 'Play'} Recording
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTranscript}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Transcript
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              {conversation.turnCount} exchanges • Started {formatTimestamp(conversation.startedAt)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Tabs */}
      <Tabs defaultValue="transcript" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transcript" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Transcript
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Analysis
          </TabsTrigger>
          <TabsTrigger value="details" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transcript">
          <Card>
            <CardHeader>
              <CardTitle>Conversation Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {conversation.turns?.length ? (
                    conversation.turns.map((turn, index) => (
                      <div
                        key={index}
                        className={`flex gap-3 p-3 rounded-lg ${
                          turn.speaker === 'user' 
                            ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                            : 'bg-gray-50 border-l-4 border-l-gray-500'
                        }`}
                      >
                        <div className="flex-shrink-0">
                          {turn.speaker === 'user' ? (
                            <User className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Bot className="h-5 w-5 text-gray-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">
                              {turn.speaker === 'user' ? 'Caller' : 'AI Agent'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTimestamp(turn.timestamp)}
                            </span>
                            {turn.confidence && (
                              <Badge variant="outline" className="text-xs">
                                {Math.round(turn.confidence * 100)}% confidence
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm">{turn.text}</p>
                          {turn.intent && (
                            <div className="mt-2">
                              <Badge variant="secondary" className="text-xs">
                                Intent: {turn.intent}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No transcript available
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis">
          <Card>
            <CardHeader>
              <CardTitle>Conversation Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {conversation.outcome && (
                  <div>
                    <h4 className="font-medium mb-3">Outcome</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-lg font-semibold capitalize">{conversation.outcome.type}</div>
                        <div className="text-sm text-muted-foreground">Resolution Type</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className={`text-lg font-semibold ${getSentimentColor(conversation.outcome.sentiment)}`}>
                          {conversation.outcome.sentiment || 'Unknown'}
                        </div>
                        <div className="text-sm text-muted-foreground">Sentiment</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-lg font-semibold">
                          {conversation.outcome.satisfaction || 'N/A'}/5
                        </div>
                        <div className="text-sm text-muted-foreground">Satisfaction</div>
                      </div>
                    </div>
                    {conversation.outcome.summary && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <h5 className="font-medium mb-2">Summary</h5>
                        <p className="text-sm">{conversation.outcome.summary}</p>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <h4 className="font-medium mb-3">Key Metrics</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-lg font-semibold">{conversation.turnCount}</div>
                      <div className="text-sm text-muted-foreground">Total Exchanges</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-lg font-semibold">
                        {conversation.turns?.filter(t => t.speaker === 'user').length || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Caller Messages</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-lg font-semibold">
                        {conversation.turns?.filter(t => t.speaker === 'assistant').length || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Agent Responses</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-lg font-semibold">
                        {conversation.turns?.filter(t => t.intent).length || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Intents Detected</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Technical Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Call Information</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Call SID:</strong> {conversation.callSid}</div>
                      <div><strong>Session ID:</strong> {conversation.sessionId}</div>
                      <div><strong>Started:</strong> {conversation.startedAt.toLocaleString()}</div>
                      {conversation.endedAt && (
                        <div><strong>Ended:</strong> {conversation.endedAt.toLocaleString()}</div>
                      )}
                      <div><strong>Status:</strong> {conversation.status}</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-3">Agent Configuration</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Agent:</strong> {conversation.agentConfig.name}</div>
                      <div><strong>Provider:</strong> {conversation.agentConfig.provider}</div>
                      <div><strong>Voice:</strong> {conversation.agentConfig.personality.voice}</div>
                      <div><strong>Language:</strong> {conversation.agentConfig.personality.language}</div>
                    </div>
                  </div>
                </div>
                
                {conversation.recordingUrl && (
                  <div>
                    <h4 className="font-medium mb-3">Recording</h4>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm">
                        <strong>URL:</strong> {conversation.recordingUrl}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 