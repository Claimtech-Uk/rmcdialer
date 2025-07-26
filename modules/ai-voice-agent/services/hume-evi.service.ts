// Hume EVI (Empathic Voice Interface) Service
// Handles real-time voice conversations using Hume's EVI WebSocket API
// Enhanced with comprehensive business context and functions

import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface EVIConfig {
  apiKey: string;
  voice?: {
    name?: string;
    description?: string;
  };
  systemPrompt?: string;
  maxDuration?: number;
  inactivityTimeout?: number;
}

export interface EVIMessage {
  type: 'user_message' | 'assistant_message' | 'audio_output' | 'assistant_end' | 'error' | 'function_call';
  message?: {
    role: 'user' | 'assistant';
    content: string;
  };
  data?: string; // base64 audio data
  functionCall?: {
    name: string;
    parameters: Record<string, any>;
  };
  timestamp: number;
}

export interface UserClaim {
  id: number;
  claim_number: string;
  claim_status: string;
  incident_date: string;
  injury_type?: string;
  estimated_value?: number;
}

export interface UserRequirement {
  id: number;
  requirement_type: string;
  description: string;
  is_completed: boolean;
  due_date?: string;
}

export interface ComprehensiveBusinessContext {
  // Call Information
  callSid: string;
  callerPhone: string;
  callerName?: string;
  
  // User Data
  userId?: number;
  userEmail?: string;
  userFirstName?: string;
  userLastName?: string;
  userAddress?: string;
  userDateOfBirth?: string;
  
  // Claims Data
  claims?: UserClaim[];
  claimsCount?: number;
  activeClaims?: UserClaim[];
  
  // Requirements Data
  requirements?: UserRequirement[];
  outstandingRequirements?: UserRequirement[];
  completedRequirements?: UserRequirement[];
  
  // Priority & Scoring
  priorityScore?: number;
  queuePosition?: number;
  callAttemptNumber?: number;
  lastCallDate?: string;
  
  // Agent Information
  availableAgents?: Array<{
    id: number;
    firstName: string;
    lastName: string;
    speciality?: string;
    isOnline: boolean;
  }>;
}

export class HumeEVIService extends EventEmitter {
  private apiKey: string;
  private ws: WebSocket | null = null;
  private configId: string | null = null;
  private isConnected = false;
  private businessContext: ComprehensiveBusinessContext | null = null;

  constructor(config: EVIConfig) {
    super();
    this.apiKey = config.apiKey;
  }

  /**
   * Create EVI configuration with comprehensive business functions
   */
  async createConfiguration(context: ComprehensiveBusinessContext): Promise<string> {
    try {
      const systemPrompt = this.buildComprehensiveSystemPrompt(context);
      
      const configData = {
        name: `RMC-Call-${context.callSid}`,
        description: "RMC Dialler customer service AI agent with full business capabilities",
        prompt: {
          text: systemPrompt
        },
        voice: {
          provider: "HUME_AI",
          name: "Professional British Customer Service Representative"
        },
        language_model: {
          model_provider: "OPEN_AI",
          model_resource: "gpt-4o",
          temperature: 0.7
        },
        tools: this.getBusinessFunctions(),
        max_duration: 1800, // 30 minutes
        inactivity_timeout: 120 // 2 minutes
      };

      console.log('🔧 Creating EVI configuration with business functions...');
      
      const response = await fetch('https://api.hume.ai/v0/evi/configs', {
        method: 'POST',
        headers: {
          'X-HUME-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create EVI config: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      this.configId = result.id;
      
      console.log(`✅ EVI configuration created with business functions: ${this.configId}`);
      return result.id;

    } catch (error) {
      console.error('❌ Failed to create EVI configuration:', error);
      throw error;
    }
  }

  /**
   * Define business functions available to the AI agent
   */
  private getBusinessFunctions() {
    return [
      {
        name: "send_magic_link",
        description: "Send a magic link via SMS to the user for document upload or claim completion",
        parameters: {
          type: "object",
          properties: {
            linkType: {
              type: "string",
              enum: ["document_upload", "claim_completion", "requirements_submission"],
              description: "Type of magic link to send"
            },
            reason: {
              type: "string",
              description: "Reason for sending the magic link (to explain to user)"
            },
            documentsNeeded: {
              type: "array",
              items: { type: "string" },
              description: "List of specific documents needed (if linkType is document_upload)"
            }
          },
          required: ["linkType", "reason"]
        }
      },
      {
        name: "transfer_to_agent",
        description: "Transfer the call to a human agent",
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "Reason for transfer (complex claim, escalation, etc.)"
            },
            preferredSpecialty: {
              type: "string",
              enum: ["general", "claims_specialist", "legal", "medical"],
              description: "Type of agent needed"
            },
            urgency: {
              type: "string",
              enum: ["low", "medium", "high", "urgent"],
              description: "Priority level for the transfer"
            },
            notes: {
              type: "string",
              description: "Notes to pass to the human agent"
            }
          },
          required: ["reason"]
        }
      },
      {
        name: "record_call_outcome",
        description: "Record the outcome of the call",
        parameters: {
          type: "object",
          properties: {
            outcomeType: {
              type: "string",
              enum: ["contacted", "no_answer", "busy", "wrong_number", "not_interested", "callback_requested", "left_voicemail", "completed_successfully"],
              description: "The outcome of the call"
            },
            notes: {
              type: "string",
              description: "Detailed notes about the conversation"
            },
            magicLinkSent: {
              type: "boolean",
              description: "Whether a magic link was sent during the call"
            },
            documentsRequested: {
              type: "array",
              items: { type: "string" },
              description: "List of documents requested from the user"
            },
            followUpRequired: {
              type: "boolean",
              description: "Whether follow-up is needed"
            },
            nextCallDelayHours: {
              type: "number",
              description: "Hours to wait before next call attempt (if applicable)"
            }
          },
          required: ["outcomeType", "notes"]
        }
      },
      {
        name: "schedule_callback",
        description: "Schedule a callback appointment with the user",
        parameters: {
          type: "object",
          properties: {
            callbackDateTime: {
              type: "string",
              description: "ISO 8601 datetime for the callback (e.g., 2024-01-15T14:30:00Z)"
            },
            reason: {
              type: "string",
              description: "Reason for the callback"
            },
            preferredAgentType: {
              type: "string",
              enum: ["same_agent", "claims_specialist", "any_available"],
              description: "Type of agent for the callback"
            },
            notes: {
              type: "string",
              description: "Notes for the callback"
            }
          },
          required: ["callbackDateTime", "reason"]
        }
      },
      {
        name: "lookup_claim_details",
        description: "Get detailed information about a specific claim",
        parameters: {
          type: "object",
          properties: {
            claimNumber: {
              type: "string",
              description: "The claim number to look up"
            }
          },
          required: ["claimNumber"]
        }
      },
      {
        name: "check_requirements_status",
        description: "Check the status of outstanding requirements for the user",
        parameters: {
          type: "object",
          properties: {
            requirementType: {
              type: "string",
              description: "Specific requirement type to check (optional - checks all if not provided)"
            }
          }
        }
      }
    ];
  }

  /**
   * Build comprehensive system prompt with all business context
   */
  private buildComprehensiveSystemPrompt(context: ComprehensiveBusinessContext): string {
    const basePrompt = `You are the AI customer service representative for RMC Dialler, a professional claims management company. You are speaking directly with a customer via phone.

## YOUR ROLE & PERSONALITY
- You are warm, professional, empathetic, and knowledgeable
- You speak naturally and conversationally (not robotic)
- You listen carefully and respond to the customer's emotional state
- You aim to resolve issues efficiently while making customers feel heard and valued
- You can access customer data and perform business functions

## AVAILABLE BUSINESS FUNCTIONS
You have access to these powerful business functions:
1. **send_magic_link** - Send secure links for document upload or claim completion
2. **transfer_to_agent** - Connect customer to human specialists when needed
3. **record_call_outcome** - Document the call results and actions taken
4. **schedule_callback** - Book follow-up appointments
5. **lookup_claim_details** - Get specific claim information
6. **check_requirements_status** - Check outstanding document requirements

## CONVERSATION FLOW
1. **Greeting**: Always start with a personalized greeting using their name
2. **Listen & Understand**: Let the customer explain their needs
3. **Take Action**: Use your business functions to help resolve their issue
4. **Confirm & Close**: Summarize actions taken and next steps
5. **Record Outcome**: Always record the call outcome before ending

## WHEN TO USE EACH FUNCTION

### Send Magic Link
- Customer needs to upload documents
- Claim completion forms need to be filled
- Requirements need to be submitted
- Always explain what the link is for and how to use it

### Transfer to Agent
- Complex legal or medical questions
- Customer requests to speak to a human
- Escalated complaints or disputes
- Issues you cannot resolve with available functions
- Always explain why you're transferring and what to expect

### Record Call Outcome
- Use at the end of EVERY call
- Include detailed notes about the conversation
- Mark if magic link was sent or callback scheduled
- Note any documents requested

### Schedule Callback
- Customer prefers to speak at a different time
- Issue requires follow-up after document submission
- Agent callback needed for complex matters
- Always confirm the date/time clearly

### Lookup Claim Details
- Customer asks about specific claim status
- Need to verify claim information
- Customer mentions a claim number

### Check Requirements Status
- Customer asks what documents they need to provide
- Want to check if requirements are complete
- Following up on previous document requests`;

    let contextualPrompt = basePrompt;

    // Add customer information
    if (context.callerName) {
      contextualPrompt += `\n\n## CUSTOMER INFORMATION
**Name**: ${context.callerName}
**Phone**: ${context.callerPhone}`;
      
      if (context.userEmail) contextualPrompt += `\n**Email**: ${context.userEmail}`;
      if (context.userAddress) contextualPrompt += `\n**Address**: ${context.userAddress}`;
    }

    // Add claims information
    if (context.claims && context.claims.length > 0) {
      contextualPrompt += `\n\n## ACTIVE CLAIMS (${context.claims.length} total)`;
      context.claims.forEach(claim => {
        contextualPrompt += `\n- **Claim ${claim.claim_number}**: ${claim.claim_status} (${claim.injury_type || 'General'})`;
        if (claim.incident_date) contextualPrompt += ` - Incident: ${claim.incident_date}`;
        if (claim.estimated_value) contextualPrompt += ` - Value: £${claim.estimated_value.toLocaleString()}`;
      });
    }

    // Add requirements information
    if (context.requirements && context.requirements.length > 0) {
      const outstanding = context.requirements.filter(req => !req.is_completed);
      if (outstanding.length > 0) {
        contextualPrompt += `\n\n## OUTSTANDING REQUIREMENTS (${outstanding.length} items)`;
        outstanding.forEach(req => {
          contextualPrompt += `\n- **${req.requirement_type}**: ${req.description}`;
          if (req.due_date) contextualPrompt += ` (Due: ${req.due_date})`;
        });
      }
    }

    // Add priority/history context
    if (context.priorityScore) {
      contextualPrompt += `\n\n## PRIORITY CONTEXT
**Priority Score**: ${context.priorityScore}/100`;
      if (context.callAttemptNumber) contextualPrompt += `\n**Call Attempt**: #${context.callAttemptNumber}`;
      if (context.lastCallDate) contextualPrompt += `\n**Last Call**: ${context.lastCallDate}`;
    }

    // Add agent availability
    if (context.availableAgents && context.availableAgents.length > 0) {
      const onlineAgents = context.availableAgents.filter(agent => agent.isOnline);
      if (onlineAgents.length > 0) {
        contextualPrompt += `\n\n## AVAILABLE AGENTS
${onlineAgents.map(agent => `- ${agent.firstName} ${agent.lastName}${agent.speciality ? ` (${agent.speciality})` : ''}`).join('\n')}`;
      }
    }

    contextualPrompt += `\n\n## CONVERSATION GUIDELINES
- **Always** start with a warm greeting using their name
- **Listen** to their concern before suggesting solutions
- **Use functions** proactively to help resolve issues
- **Explain** what you're doing ("I'm sending you a secure link to...")
- **Confirm** actions taken ("I've scheduled your callback for...")
- **End** every call by recording the outcome
- **Be human** - show empathy and understanding

Remember: You're having a live phone conversation. Be natural, helpful, and efficient!`;

    return contextualPrompt;
  }

  /**
   * Connect to EVI WebSocket with comprehensive business context
   */
  async connect(context: ComprehensiveBusinessContext): Promise<void> {
    try {
      this.businessContext = context;
      
      // Create configuration with business functions
      const configId = await this.createConfiguration(context);
      
      // Connect to EVI WebSocket
      const wsUrl = `wss://api.hume.ai/v0/evi/chat?api_key=${this.apiKey}&config_id=${configId}`;
      
      console.log('🔗 Connecting to Hume EVI with business capabilities...');
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        console.log('✅ Connected to Hume EVI with business functions');
        this.isConnected = true;
        this.emit('connected');
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleEVIMessage(message);
        } catch (error) {
          console.error('❌ Failed to parse EVI message:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('🔌 EVI connection closed');
        this.isConnected = false;
        this.emit('disconnected');
      });

      this.ws.on('error', (error) => {
        console.error('❌ EVI WebSocket error:', error);
        this.emit('error', error);
      });

    } catch (error) {
      console.error('❌ Failed to connect to EVI:', error);
      throw error;
    }
  }

  /**
   * Handle incoming EVI messages including function calls
   */
  private handleEVIMessage(message: any): void {
    const eviMessage: EVIMessage = {
      type: message.type,
      message: message.message,
      data: message.data,
      functionCall: message.function_call,
      timestamp: Date.now()
    };

    console.log(`📨 EVI message: ${message.type}`);
    
    switch (message.type) {
      case 'user_message':
        console.log(`👤 User said: ${message.message?.content}`);
        this.emit('user_message', eviMessage);
        break;
        
      case 'assistant_message':
        console.log(`🤖 Assistant responding: ${message.message?.content}`);
        this.emit('assistant_message', eviMessage);
        break;
        
      case 'audio_output':
        console.log(`🎵 Audio output received (${message.data?.length || 0} bytes)`);
        this.emit('audio_output', eviMessage);
        break;
        
      case 'function_call':
        console.log(`🔧 Function call: ${message.function_call?.name}`, message.function_call?.parameters);
        this.emit('function_call', eviMessage);
        break;
        
      case 'assistant_end':
        console.log('✅ Assistant finished speaking');
        this.emit('assistant_end', eviMessage);
        break;
        
      default:
        console.log(`📝 Unknown EVI message type: ${message.type}`);
        this.emit('message', eviMessage);
    }
  }

  /**
   * Send audio input to EVI
   */
  sendAudio(audioData: string): void {
    if (!this.isConnected || !this.ws) {
      console.warn('⚠️ Cannot send audio: not connected to EVI');
      return;
    }

    const message = {
      type: 'audio_input',
      data: audioData
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send function result back to EVI
   */
  sendFunctionResult(functionCallId: string, result: any): void {
    if (!this.isConnected || !this.ws) {
      console.warn('⚠️ Cannot send function result: not connected to EVI');
      return;
    }

    const message = {
      type: 'function_result',
      function_call_id: functionCallId,
      result: result
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Get current business context
   */
  getBusinessContext(): ComprehensiveBusinessContext | null {
    return this.businessContext;
  }

  /**
   * Disconnect from EVI
   */
  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    
    // Clean up configuration if needed
    if (this.configId) {
      try {
        await this.cleanupConfiguration(this.configId);
      } catch (error) {
        console.warn('⚠️ Failed to cleanup EVI configuration:', error);
      }
    }
  }

  /**
   * Clean up EVI configuration after call
   */
  private async cleanupConfiguration(configId: string): Promise<void> {
    try {
      await fetch(`https://api.hume.ai/v0/evi/configs/${configId}`, {
        method: 'DELETE',
        headers: {
          'X-HUME-API-KEY': this.apiKey
        }
      });
      console.log(`🗑️ Cleaned up EVI configuration: ${configId}`);
    } catch (error) {
      console.error('❌ Failed to cleanup EVI configuration:', error);
    }
  }

  /**
   * Check if connected
   */
  isConnectionActive(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
} 