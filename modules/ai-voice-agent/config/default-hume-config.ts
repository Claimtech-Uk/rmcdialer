import { HumeEVIConfig } from '../types/ai-voice.types';

// Default Hume EVI configuration for inbound calls
export const defaultHumeConfig: HumeEVIConfig = {
  id: 'default-hume-evi',
  name: 'RMC Dialler Hume Agent',
  provider: 'hume-evi',
  personality: {
    name: 'RMC Assistant',
    voice: 'empathic', // Hume's natural voice
    tone: 'professional',
    language: 'en'
  },
  capabilities: {
    canTransferToHuman: true,
    canAccessCustomerData: true,
    canScheduleAppointments: false,
    canProcessPayments: false
  },
  fallbackBehavior: 'transfer',
  // These should be set from environment variables in production
  configId: process.env.HUME_EVI_CONFIG_ID || 'your-hume-config-id',
  apiKey: process.env.HUME_API_KEY || 'your-hume-api-key'
}; 