// Conversation Engine Service
// Handles conversation logic, prompts, function calling, and intent detection

import OpenAI from 'openai';
import { 
  ConversationTurn, 
  ConversationIntent, 
  FunctionCall, 
  FunctionContext, 
  BusinessFunction,
  AudioStreamSession,
  AudioStreamError
} from '../types/audio-streaming.types';

export class ConversationEngineService {
  private openai: OpenAI;
  private functions: Map<string, BusinessFunction> = new Map();
  private systemPrompt: string;

  constructor(apiKey: string, systemPrompt?: string) {
    this.openai = new OpenAI({ apiKey });
    this.systemPrompt = systemPrompt || this.getDefaultSystemPrompt();
  }

  /**
   * Process a user's message and generate a response
   */
  async processMessage(
    userMessage: string,
    session: AudioStreamSession
  ): Promise<{ response: string; functionCalls: FunctionCall[]; intent: ConversationIntent }> {
    try {
      console.log(`🧠 Processing user message: "${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}"`);

      // Build conversation context
      const messages = this.buildConversationContext(userMessage, session);

      // Prepare function definitions for OpenAI
      const tools = this.getFunctionDefinitions();

      // Call OpenAI with function calling capability
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-1106-preview', // Use latest model with function calling
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 500
      });

      const assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) {
        throw new Error('No response from OpenAI');
      }

      // Process function calls if any
      const functionCalls: FunctionCall[] = [];
      if (assistantMessage.tool_calls) {
        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.type === 'function') {
            const functionCall = await this.executeFunctionCall(toolCall, session);
            functionCalls.push(functionCall);
          }
        }
      }

      // Get the response text
      const responseText = assistantMessage.content || 'I understand.';

      // Detect intent
      const intent = this.detectIntent(userMessage, responseText, functionCalls);

      console.log(`✅ Generated response with ${functionCalls.length} function calls`);

      return {
        response: responseText,
        functionCalls,
        intent
      };

    } catch (error) {
      console.error('Conversation engine error:', error);
      
      throw {
        type: 'conversation_error',
        message: 'Failed to process conversation',
        details: error,
        timestamp: new Date(),
        sessionId: session.sessionId,
        recoverable: true
      } as AudioStreamError;
    }
  }

  /**
   * Register a business function
   */
  registerFunction(func: BusinessFunction): void {
    this.functions.set(func.name, func);
    console.log(`📝 Registered function: ${func.name}`);
  }

  /**
   * Register multiple business functions
   */
  registerFunctions(functions: BusinessFunction[]): void {
    functions.forEach(func => this.registerFunction(func));
  }

  /**
   * Build conversation context for OpenAI
   */
  private buildConversationContext(userMessage: string, session: AudioStreamSession): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // System prompt with caller context
    const systemPromptWithContext = this.buildContextualSystemPrompt(session);
    messages.push({ role: 'system', content: systemPromptWithContext });

    // Add conversation history (last 10 turns to stay within token limits)
    const recentHistory = session.conversationHistory.slice(-10);
    for (const turn of recentHistory) {
      if (turn.speaker === 'caller') {
        messages.push({ role: 'user', content: turn.text });
      } else {
        messages.push({ role: 'assistant', content: turn.text });
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    return messages;
  }

  /**
   * Build system prompt with caller context
   */
  private buildContextualSystemPrompt(session: AudioStreamSession): string {
    let prompt = this.systemPrompt;

    if (session.callerInfo) {
      prompt += '\n\nCALLER CONTEXT:\n';
      
      if (session.callerInfo.name) {
        prompt += `- Caller name: ${session.callerInfo.name}\n`;
      }
      
      prompt += `- Phone number: ${session.callerInfo.phoneNumber}\n`;
      
      if (session.callerInfo.claims && session.callerInfo.claims.length > 0) {
        prompt += `- Active claims: ${session.callerInfo.claims.length} claims\n`;
        prompt += session.callerInfo.claims.map(claim => 
          `  * ${claim.type} claim with ${claim.lender} (Status: ${claim.status})`
        ).join('\n') + '\n';
      }
      
      if (session.callerInfo.requirements && session.callerInfo.requirements.length > 0) {
        prompt += `- Outstanding requirements: ${session.callerInfo.requirements.length} items\n`;
      }
    }

    return prompt;
  }

  /**
   * Get function definitions for OpenAI
   */
  private getFunctionDefinitions(): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return Array.from(this.functions.values()).map(func => ({
      type: 'function',
      function: {
        name: func.name,
        description: func.description,
        parameters: func.parameters
      }
    }));
  }

  /**
   * Execute a function call
   */
  private async executeFunctionCall(
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
    session: AudioStreamSession
  ): Promise<FunctionCall> {
    const functionName = toolCall.function.name;
    const parameters = JSON.parse(toolCall.function.arguments || '{}');

    console.log(`🔧 Executing function: ${functionName}`, parameters);

    const functionCall: FunctionCall = {
      name: functionName,
      parameters,
      executedAt: new Date(),
      success: false
    };

    try {
      const func = this.functions.get(functionName);
      if (!func) {
        throw new Error(`Function ${functionName} not found`);
      }

      const context: FunctionContext = {
        sessionId: session.sessionId,
        callSid: session.callSid,
        callerInfo: session.callerInfo,
        conversationHistory: session.conversationHistory
      };

      const result = await func.handler(parameters, context);
      
      functionCall.result = result;
      functionCall.success = true;
      
      console.log(`✅ Function ${functionName} executed successfully`);

    } catch (error) {
      console.error(`❌ Function ${functionName} failed:`, error);
      functionCall.error = error instanceof Error ? error.message : String(error);
      functionCall.success = false;
    }

    return functionCall;
  }

  /**
   * Detect conversation intent
   */
  private detectIntent(userMessage: string, response: string, functionCalls: FunctionCall[]): ConversationIntent {
    const message = userMessage.toLowerCase();
    
    // Simple intent detection - could be enhanced with ML models
    if (message.includes('hello') || message.includes('hi') || message.includes('good morning')) {
      return {
        category: 'greeting',
        confidence: 0.9,
        requiresAction: false
      };
    }
    
    if (message.includes('claim') || message.includes('refund') || message.includes('compensation')) {
      return {
        category: 'claim_inquiry',
        confidence: 0.8,
        requiresAction: true,
        suggestedActions: ['lookup_claims', 'check_requirements']
      };
    }
    
    if (message.includes('appointment') || message.includes('schedule') || message.includes('meeting')) {
      return {
        category: 'scheduling',
        confidence: 0.8,
        requiresAction: true,
        suggestedActions: ['check_availability', 'book_appointment']
      };
    }
    
    if (message.includes('complaint') || message.includes('problem') || message.includes('issue')) {
      return {
        category: 'complaint',
        confidence: 0.7,
        requiresAction: true,
        suggestedActions: ['escalate', 'transfer_to_human']
      };
    }
    
    if (message.includes('transfer') || message.includes('speak to someone') || message.includes('human')) {
      return {
        category: 'transfer',
        confidence: 0.9,
        requiresAction: true,
        suggestedActions: ['transfer_to_human']
      };
    }
    
    if (message.includes('goodbye') || message.includes('bye') || message.includes('thank you')) {
      return {
        category: 'goodbye',
        confidence: 0.8,
        requiresAction: false
      };
    }

    return {
      category: 'other',
      confidence: 0.5,
      requiresAction: functionCalls.length > 0
    };
  }

  /**
   * Get default system prompt
   */
  private getDefaultSystemPrompt(): string {
    return `You are a professional and empathetic customer service representative for RMC Dialler, a claims management company. Your role is to:

1. Assist customers with their claims and requirements
2. Provide helpful information about their cases
3. Schedule appointments when needed
4. Escalate complex issues to human agents
5. Maintain a friendly, professional tone at all times

Guidelines:
- Be concise but thorough in your responses
- Always acknowledge the customer's concerns
- Use the available functions to look up specific information
- If you cannot help with something, offer to transfer to a human agent
- Keep responses under 50 words when possible for natural conversation flow
- Use empathetic language and show understanding

Available functions include:
- Looking up caller information and claims
- Checking requirements and documentation
- Scheduling appointments
- Transferring to human agents

Remember: You are speaking, not writing, so use natural conversational language.`;
  }

  /**
   * Update system prompt
   */
  updateSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
    console.log('📝 Updated system prompt');
  }
} 