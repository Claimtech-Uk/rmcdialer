// Voice Agent Settings Component
// Configuration interface for AI voice agent behavior

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Save, 
  TestTube, 
  Volume2, 
  Brain, 
  Shield, 
  Phone,
  User,
  MessageSquare
} from 'lucide-react';
import { VoiceAgentConfig } from '../types/ai-voice.types';

interface VoiceAgentSettingsProps {
  config: VoiceAgentConfig;
  onSave: (config: VoiceAgentConfig) => void;
  onTest: () => void;
}

export function VoiceAgentSettings({ config, onSave, onTest }: VoiceAgentSettingsProps) {
  const [formData, setFormData] = useState<VoiceAgentConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      await onTest();
    } finally {
      setIsTesting(false);
    }
  };

  const updateField = (path: string, value: any) => {
    const keys = path.split('.');
    const newFormData = { ...formData };
    let current: any = newFormData;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    
    setFormData(newFormData);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Voice Agent Settings</h2>
          <p className="text-gray-500">Configure your AI voice assistant behavior</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={handleTest}
            disabled={isTesting}
          >
            <TestTube className="h-4 w-4 mr-2" />
            {isTesting ? 'Testing...' : 'Test Agent'}
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Basic Configuration</span>
            </CardTitle>
            <CardDescription>
              Basic agent identity and provider settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Agent Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Enter agent name"
              />
            </div>
            
            <div>
              <Label htmlFor="provider">AI Provider</Label>
              <Select value={formData.provider} onValueChange={(value) => updateField('provider', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="twilio-ai-assistants">Twilio AI Assistants</SelectItem>
                  <SelectItem value="conversation-relay">ConversationRelay</SelectItem>
                  <SelectItem value="gemini-live">Gemini Live</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="fallback">Fallback Behavior</Label>
              <Select 
                value={formData.fallbackBehavior} 
                onValueChange={(value) => updateField('fallbackBehavior', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">Transfer to Human</SelectItem>
                  <SelectItem value="escalate">Escalate to Manager</SelectItem>
                  <SelectItem value="end-call">End Call</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Personality Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-5 w-5" />
              <span>Personality</span>
            </CardTitle>
            <CardDescription>
              Configure how your agent speaks and behaves
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="personalityName">Agent Persona Name</Label>
              <Input
                id="personalityName"
                value={formData.personality.name}
                onChange={(e) => updateField('personality.name', e.target.value)}
                placeholder="e.g., Sarah, Alex, etc."
              />
            </div>
            
            <div>
              <Label htmlFor="voice">Voice Type</Label>
              <Select 
                value={formData.personality.voice} 
                onValueChange={(value) => updateField('personality.voice', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alice">Alice (Female, US)</SelectItem>
                  <SelectItem value="man">Man (Male, US)</SelectItem>
                  <SelectItem value="woman">Woman (Female, US)</SelectItem>
                  <SelectItem value="polly.Joanna">Joanna (Female, US)</SelectItem>
                  <SelectItem value="polly.Matthew">Matthew (Male, US)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="tone">Communication Tone</Label>
              <Select 
                value={formData.personality.tone} 
                onValueChange={(value) => updateField('personality.tone', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="language">Language</Label>
              <Select 
                value={formData.personality.language} 
                onValueChange={(value) => updateField('personality.language', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en-US">English (US)</SelectItem>
                  <SelectItem value="en-GB">English (UK)</SelectItem>
                  <SelectItem value="es-ES">Spanish</SelectItem>
                  <SelectItem value="fr-FR">French</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Capabilities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Agent Capabilities</span>
            </CardTitle>
            <CardDescription>
              Define what your agent can and cannot do
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="canTransfer">Transfer to Human</Label>
                <p className="text-sm text-gray-500">Allow agent to transfer difficult calls</p>
              </div>
              <Switch
                id="canTransfer"
                checked={formData.capabilities.canTransferToHuman}
                onCheckedChange={(value) => updateField('capabilities.canTransferToHuman', value)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="canAccessData">Access Customer Data</Label>
                <p className="text-sm text-gray-500">Lookup customer information during calls</p>
              </div>
              <Switch
                id="canAccessData"
                checked={formData.capabilities.canAccessCustomerData}
                onCheckedChange={(value) => updateField('capabilities.canAccessCustomerData', value)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="canSchedule">Schedule Appointments</Label>
                <p className="text-sm text-gray-500">Book appointments with calendar integration</p>
              </div>
              <Switch
                id="canSchedule"
                checked={formData.capabilities.canScheduleAppointments}
                onCheckedChange={(value) => updateField('capabilities.canScheduleAppointments', value)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="canProcessPayments">Process Payments</Label>
                <p className="text-sm text-gray-500">Handle payment processing during calls</p>
              </div>
              <Switch
                id="canProcessPayments"
                checked={formData.capabilities.canProcessPayments}
                onCheckedChange={(value) => updateField('capabilities.canProcessPayments', value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Advanced Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5" />
              <span>Advanced Settings</span>
            </CardTitle>
            <CardDescription>
              Fine-tune conversation behavior and workflows
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="greeting">Custom Greeting</Label>
              <Textarea
                id="greeting"
                value={formData.customGreeting || ''}
                onChange={(e) => updateField('customGreeting', e.target.value)}
                placeholder="Enter custom greeting message (optional)"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="instructions">System Instructions</Label>
              <Textarea
                id="instructions"
                value={formData.systemInstructions || ''}
                onChange={(e) => updateField('systemInstructions', e.target.value)}
                placeholder="Additional instructions for the AI agent behavior"
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="maxDuration">Max Call Duration (minutes)</Label>
              <Input
                id="maxDuration"
                type="number"
                value={formData.maxCallDuration || 30}
                onChange={(e) => updateField('maxCallDuration', parseInt(e.target.value))}
                min={1}
                max={120}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Provider-Specific Settings */}
      {formData.provider === 'twilio-ai-assistants' && (
        <Card>
          <CardHeader>
            <CardTitle>Twilio AI Assistants Configuration</CardTitle>
            <CardDescription>
              Provider-specific settings for Twilio AI Assistants
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="assistantSid">Assistant SID</Label>
              <Input
                id="assistantSid"
                value={formData.assistantSid || ''}
                onChange={(e) => updateField('assistantSid', e.target.value)}
                placeholder="Twilio Assistant SID (starts with 'PL')"
              />
            </div>
            
            <div>
              <Label htmlFor="knowledge">Knowledge Base SID (Optional)</Label>
              <Input
                id="knowledge"
                value={formData.knowledgeBaseSid || ''}
                onChange={(e) => updateField('knowledgeBaseSid', e.target.value)}
                placeholder="Knowledge Base SID for enhanced responses"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 