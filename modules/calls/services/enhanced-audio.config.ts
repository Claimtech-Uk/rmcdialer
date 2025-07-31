/**
 * Enhanced Audio Configuration Service
 * Provides progressive enhancement for noise cancellation with safe fallbacks
 */

export interface AudioQualityLevel {
  name: string;
  constraints: MediaTrackConstraints;
  description: string;
  browserSupport: string[];
}

export class EnhancedAudioConfig {
  
  /**
   * Audio quality profiles from basic to premium
   * Ordered by compatibility (most compatible first)
   */
  static readonly AUDIO_PROFILES: AudioQualityLevel[] = [
    {
      name: 'basic',
      description: 'Basic noise suppression - Universal compatibility',
      browserSupport: ['chrome', 'firefox', 'safari', 'edge'],
      constraints: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,  // Twilio recommended baseline
      }
    },
    {
      name: 'enhanced',
      description: 'Enhanced noise suppression - Modern browsers',
      browserSupport: ['chrome', 'firefox', 'edge'],
      constraints: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 24000,           // Higher quality without being too aggressive
        channelCount: 1,             // Mono for better noise processing
        // Note: Removed latency constraint for better compatibility
      }
    },
    {
      name: 'premium',
      description: 'Premium noise suppression - Chrome/Chromium only',
      browserSupport: ['chrome', 'edge'],
      constraints: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,           // High quality
        channelCount: 1,             // Mono for optimal processing
        sampleSize: 16,              // 16-bit audio
        // Advanced noise suppression settings
        ...(this.supportsAdvancedNoiseSuppression() && {
          noiseSuppression: {
            exact: true
          },
          echoCancellation: {
            exact: true  
          }
        })
      }
    }
  ];

  /**
   * Detect browser capabilities for enhanced audio features
   */
  static getBrowserCapabilities(): {
    userAgent: string;
    browserName: string;
    supportsAdvancedConstraints: boolean;
    recommendedProfile: string;
  } {
    const userAgent = navigator.userAgent.toLowerCase();
    
    let browserName = 'unknown';
    let supportsAdvancedConstraints = false;
    let recommendedProfile = 'basic';

    if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
      browserName = 'chrome';
      supportsAdvancedConstraints = true;
      recommendedProfile = 'premium';
    } else if (userAgent.includes('edg')) {
      browserName = 'edge';
      supportsAdvancedConstraints = true;
      recommendedProfile = 'enhanced';
    } else if (userAgent.includes('firefox')) {
      browserName = 'firefox';
      supportsAdvancedConstraints = false;
      recommendedProfile = 'enhanced';
    } else if (userAgent.includes('safari')) {
      browserName = 'safari';
      supportsAdvancedConstraints = false;
      recommendedProfile = 'basic';
    }

    return {
      userAgent,
      browserName,
      supportsAdvancedConstraints,
      recommendedProfile
    };
  }

  /**
   * Test if browser supports advanced noise suppression
   */
  static supportsAdvancedNoiseSuppression(): boolean {
    const capabilities = this.getBrowserCapabilities();
    return capabilities.browserName === 'chrome' || capabilities.browserName === 'edge';
  }

  /**
   * Get optimal audio constraints for current browser
   * Automatically selects best compatible profile
   */
  static getOptimalConstraints(): {
    constraints: MediaTrackConstraints;
    profileUsed: string;
    fallbackLevels: string[];
  } {
    const capabilities = this.getBrowserCapabilities();
    const recommendedProfile = this.AUDIO_PROFILES.find(
      profile => profile.name === capabilities.recommendedProfile
    ) || this.AUDIO_PROFILES[0];

    // Create fallback chain
    const fallbackLevels = this.AUDIO_PROFILES
      .filter(profile => profile.browserSupport.includes(capabilities.browserName))
      .map(profile => profile.name);

    return {
      constraints: recommendedProfile.constraints,
      profileUsed: recommendedProfile.name,
      fallbackLevels
    };
  }

  /**
   * Attempt getUserMedia with progressive fallback
   * Returns the successful constraints and stream
   */
  static async requestEnhancedAudio(): Promise<{
    stream: MediaStream;
    constraintsUsed: MediaTrackConstraints;
    profileUsed: string;
    warnings: string[];
  }> {
    const capabilities = this.getBrowserCapabilities();
    const warnings: string[] = [];
    
    // Try profiles in order of preference (premium -> enhanced -> basic)
    const profiles = [...this.AUDIO_PROFILES].reverse();
    
    for (const profile of profiles) {
      // Skip if browser doesn't support this profile
      if (!profile.browserSupport.includes(capabilities.browserName)) {
        continue;
      }

      try {
        console.log(`🎤 Attempting ${profile.name} audio profile...`);
        
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: profile.constraints
        });

        // Verify we got audio tracks
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          stream.getTracks().forEach(track => track.stop());
          throw new Error('No audio tracks available');
        }

        // Log successful audio track settings
        const settings = audioTracks[0].getSettings();
        console.log(`✅ ${profile.name} audio profile successful:`, {
          sampleRate: settings.sampleRate,
          channelCount: settings.channelCount,
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          autoGainControl: settings.autoGainControl
        });

        return {
          stream,
          constraintsUsed: profile.constraints,
          profileUsed: profile.name,
          warnings
        };

      } catch (error: any) {
        console.warn(`⚠️ ${profile.name} audio profile failed:`, error.message);
        warnings.push(`${profile.name}: ${error.message}`);
        
        // Continue to next profile
        continue;
      }
    }

    // If all profiles failed, this is a critical error
    throw new Error(`All audio profiles failed. Browser: ${capabilities.browserName}. Errors: ${warnings.join('; ')}`);
  }

  /**
   * Validate audio stream quality
   * Checks if the stream meets minimum requirements for noise suppression
   */
  static validateAudioQuality(stream: MediaStream): {
    isValid: boolean;
    metrics: {
      sampleRate?: number;
      channelCount?: number;
      echoCancellation?: boolean;
      noiseSuppression?: boolean;
    };
    recommendations: string[];
  } {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      return {
        isValid: false,
        metrics: {},
        recommendations: ['No audio tracks found']
      };
    }

    const settings = audioTracks[0].getSettings();
    const recommendations: string[] = [];
    
    // Check sample rate
    if (settings.sampleRate && settings.sampleRate < 16000) {
      recommendations.push('Sample rate below 16kHz may impact voice quality');
    }
    
    // Check noise suppression
    if (!settings.noiseSuppression) {
      recommendations.push('Noise suppression not enabled - background noise may be noticeable');
    }
    
    // Check echo cancellation
    if (!settings.echoCancellation) {
      recommendations.push('Echo cancellation not enabled - may cause audio feedback');
    }

    return {
      isValid: true,
      metrics: {
        sampleRate: settings.sampleRate,
        channelCount: settings.channelCount,
        echoCancellation: settings.echoCancellation,
        noiseSuppression: settings.noiseSuppression
      },
      recommendations
    };
  }
} 