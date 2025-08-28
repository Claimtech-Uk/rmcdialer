# Audio Conversion Specification

## Overview

This document details the exact audio conversion requirements and algorithms for the Twilio-Hume bridge.

---

## Audio Formats

### Twilio Media Streams
- **Codec**: `audio/x-mulaw` (G.711 μ-law/PCMU)
- **Sample Rate**: 8000 Hz
- **Channels**: 1 (mono)
- **Bit Depth**: 8-bit (μ-law encoded)
- **Transport**: Base64 encoded
- **Packet Size**: 160 samples (20ms)
- **Packet Rate**: 50 packets/second

### Hume EVI Input
- **Format**: `linear16` (PCM)
- **Sample Rate**: 8000 Hz (for telephony)
- **Channels**: 1 (mono)
- **Bit Depth**: 16-bit signed integer
- **Byte Order**: Little-endian
- **Transport**: Base64 encoded
- **Streaming**: Continuous, not file-based

### Hume EVI Output
- **Format**: WAV file
- **Sample Rate**: 48000 Hz
- **Channels**: 1 (mono)
- **Bit Depth**: 16-bit PCM
- **Header**: 44-byte WAV header
- **Transport**: Base64 encoded

---

## Conversion Algorithms

### μ-law to Linear16 PCM

```javascript
// μ-law decoding table (ITU-T G.711)
const MULAW_TABLE = [
    -32124, -31100, -30076, -29052, -28028, -27004, -25980, -24956,
    -23932, -22908, -21884, -20860, -19836, -18812, -17788, -16764,
    -15996, -15484, -14972, -14460, -13948, -13436, -12924, -12412,
    -11900, -11388, -10876, -10364,  -9852,  -9340,  -8828,  -8316,
     -7932,  -7676,  -7420,  -7164,  -6908,  -6652,  -6396,  -6140,
     -5884,  -5628,  -5372,  -5116,  -4860,  -4604,  -4348,  -4092,
     -3900,  -3772,  -3644,  -3516,  -3388,  -3260,  -3132,  -3004,
     -2876,  -2748,  -2620,  -2492,  -2364,  -2236,  -2108,  -1980,
     -1884,  -1820,  -1756,  -1692,  -1628,  -1564,  -1500,  -1436,
     -1372,  -1308,  -1244,  -1180,  -1116,  -1052,   -988,   -924,
      -876,   -844,   -812,   -780,   -748,   -716,   -684,   -652,
      -620,   -588,   -556,   -524,   -492,   -460,   -428,   -396,
      -372,   -356,   -340,   -324,   -308,   -292,   -276,   -260,
      -244,   -228,   -212,   -196,   -180,   -164,   -148,   -132,
      -120,   -112,   -104,    -96,    -88,    -80,    -72,    -64,
       -56,    -48,    -40,    -32,    -24,    -16,     -8,      0,
     32124,  31100,  30076,  29052,  28028,  27004,  25980,  24956,
     23932,  22908,  21884,  20860,  19836,  18812,  17788,  16764,
     15996,  15484,  14972,  14460,  13948,  13436,  12924,  12412,
     11900,  11388,  10876,  10364,   9852,   9340,   8828,   8316,
      7932,   7676,   7420,   7164,   6908,   6652,   6396,   6140,
      5884,   5628,   5372,   5116,   4860,   4604,   4348,   4092,
      3900,   3772,   3644,   3516,   3388,   3260,   3132,   3004,
      2876,   2748,   2620,   2492,   2364,   2236,   2108,   1980,
      1884,   1820,   1756,   1692,   1628,   1564,   1500,   1436,
      1372,   1308,   1244,   1180,   1116,   1052,    988,    924,
       876,    844,    812,    780,    748,    716,    684,    652,
       620,    588,    556,    524,    492,    460,    428,    396,
       372,    356,    340,    324,    308,    292,    276,    260,
       244,    228,    212,    196,    180,    164,    148,    132,
       120,    112,    104,     96,     88,     80,     72,     64,
        56,     48,     40,     32,     24,     16,      8,      0
];

function mulawToLinear16Sample(mulaw: number): number {
    return MULAW_TABLE[mulaw & 0xFF];
}
```

### Linear16 PCM to μ-law

```javascript
function linear16ToMulawSample(sample: number): number {
    const BIAS = 0x84;
    const MAX = 32635;
    
    // Handle sign
    let sign = 0;
    if (sample < 0) {
        sign = 0x80;
        sample = -sample;
    }
    
    // Clip
    if (sample > MAX) sample = MAX;
    
    // Add bias
    sample += BIAS;
    
    // Find exponent
    let exponent = 7;
    let expMask = 0x4000;
    while ((sample & expMask) === 0 && exponent > 0) {
        exponent--;
        expMask >>= 1;
    }
    
    // Extract mantissa
    const mantissa = (sample >> (exponent + 3)) & 0x0F;
    
    // Combine and invert
    const mulawByte = ~(sign | (exponent << 4) | mantissa) & 0xFF;
    
    return mulawByte;
}
```

### Downsampling (48kHz to 8kHz)

```javascript
function downsample48to8(input: Int16Array): Int16Array {
    const ratio = 6; // 48000 / 8000
    const outputLength = Math.floor(input.length / ratio);
    const output = new Int16Array(outputLength);
    
    for (let i = 0; i < outputLength; i++) {
        // Simple decimation - take every 6th sample
        output[i] = input[i * ratio];
    }
    
    return output;
}
```

### WAV Header Parsing

```javascript
function parseWavHeader(data: Uint8Array): {
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
    dataOffset: number;
} {
    // RIFF header
    if (data[0] !== 0x52 || data[1] !== 0x49 || 
        data[2] !== 0x46 || data[3] !== 0x46) {
        throw new Error('Not a WAV file');
    }
    
    // Find 'fmt ' chunk
    let offset = 12;
    while (offset < data.length - 8) {
        const chunkId = String.fromCharCode(
            data[offset], data[offset+1], 
            data[offset+2], data[offset+3]
        );
        const chunkSize = data[offset+4] | (data[offset+5] << 8) | 
                         (data[offset+6] << 16) | (data[offset+7] << 24);
        
        if (chunkId === 'fmt ') {
            const format = data[offset+8] | (data[offset+9] << 8);
            const channels = data[offset+10] | (data[offset+11] << 8);
            const sampleRate = data[offset+12] | (data[offset+13] << 8) | 
                              (data[offset+14] << 16) | (data[offset+15] << 24);
            const bitsPerSample = data[offset+22] | (data[offset+23] << 8);
            
            // Find 'data' chunk
            offset = offset + 8 + chunkSize;
            while (offset < data.length - 8) {
                const dataId = String.fromCharCode(
                    data[offset], data[offset+1], 
                    data[offset+2], data[offset+3]
                );
                
                if (dataId === 'data') {
                    return {
                        sampleRate,
                        channels,
                        bitsPerSample,
                        dataOffset: offset + 8
                    };
                }
                
                const dataSize = data[offset+4] | (data[offset+5] << 8) | 
                                (data[offset+6] << 16) | (data[offset+7] << 24);
                offset = offset + 8 + dataSize;
            }
        }
        
        offset = offset + 8 + chunkSize;
    }
    
    throw new Error('Invalid WAV format');
}
```

---

## Base64 Encoding/Decoding

### Encoding PCM to Base64
```javascript
function pcmToBase64(pcmData: Int16Array): string {
    // Convert to bytes (little-endian)
    const bytes = new Uint8Array(pcmData.buffer, 
                                 pcmData.byteOffset, 
                                 pcmData.byteLength);
    
    // Convert to base64
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    
    return btoa(binary);
}
```

### Decoding Base64 to PCM
```javascript
function base64ToPCM(base64: string): Int16Array {
    // Decode base64
    const binary = atob(base64);
    
    // Convert to bytes
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    
    // Convert to 16-bit samples (little-endian)
    const pcmData = new Int16Array(bytes.buffer);
    
    return pcmData;
}
```

---

## Message Formats

### Twilio → PartyKit
```json
{
    "event": "media",
    "streamSid": "MZxxx",
    "media": {
        "track": "inbound",
        "chunk": "0",
        "timestamp": "1234567890",
        "payload": "base64_mulaw_audio"
    }
}
```

### PartyKit → Hume
```json
{
    "type": "audio_input",
    "data": "base64_linear16_pcm"
}
```

### Hume → PartyKit
```json
{
    "type": "audio_output",
    "data": "base64_wav_file_with_header"
}
```

### PartyKit → Twilio
```json
{
    "event": "media",
    "streamSid": "MZxxx",
    "media": {
        "payload": "base64_mulaw_audio"
    }
}
```

---

## Testing

### Generate Test Tone (440Hz)
```javascript
function generateTestTone(durationMs: number): Int16Array {
    const sampleRate = 8000;
    const frequency = 440;
    const samples = (sampleRate * durationMs) / 1000;
    const tone = new Int16Array(samples);
    
    for (let i = 0; i < samples; i++) {
        const t = i / sampleRate;
        tone[i] = Math.sin(2 * Math.PI * frequency * t) * 16384;
    }
    
    return tone;
}
```

### Verify Conversion Round-Trip
```javascript
function testRoundTrip() {
    // Create test pattern
    const original = new Int16Array([0, 16384, -16384, 8192, -8192]);
    
    // Convert to μ-law
    const mulaw = new Uint8Array(original.length);
    for (let i = 0; i < original.length; i++) {
        mulaw[i] = linear16ToMulawSample(original[i]);
    }
    
    // Convert back to PCM
    const recovered = new Int16Array(mulaw.length);
    for (let i = 0; i < mulaw.length; i++) {
        recovered[i] = mulawToLinear16Sample(mulaw[i]);
    }
    
    // Check error (μ-law is lossy)
    for (let i = 0; i < original.length; i++) {
        const error = Math.abs(original[i] - recovered[i]);
        console.log(`Sample ${i}: ${original[i]} → ${recovered[i]} (error: ${error})`);
    }
}
```

---

## Known Issues

1. **Byte Order**: JavaScript TypedArrays are platform-dependent for endianness
2. **Audio Levels**: Telephony audio is typically 10-20dB quieter than browser audio
3. **Silence Detection**: Hume may not respond to very quiet audio
4. **Packet Timing**: Sending packets too fast/slow can cause issues
5. **Buffer Underrun**: Not buffering enough audio can cause choppy playback

---

*Last Updated: August 28, 2025*
