# Implementation TODOs and Missing Features

## High Priority TODOs

### 1. Mute Functionality (FloatingCallStatus.tsx:64)
**Status**: Missing Implementation
**Description**: Implement actual mute functionality with Twilio device
**Impact**: Users cannot mute calls from floating status component
**Implementation**: 
```typescript
// Need to access Twilio device and call device.mute() / device.unmute()
const handleMuteToggle = () => {
  const device = getDevice();
  if (device && device.activeCall) {
    if (isMuted) {
      device.activeCall.unmute();
    } else {
      device.activeCall.mute();
    }
    setIsMuted(!isMuted);
  }
};
```

### 2. Queue ID Mapping (useGlobalCall.ts:81)
**Status**: Missing Implementation  
**Description**: Map queue information to actual queue IDs in database
**Impact**: Call sessions not properly linked to queue contexts
**Implementation**: Need to add queueId field mapping from queueInfo

### 3. Call Completion Handling (CallPreviewPanel.tsx:99)
**Status**: Missing Implementation
**Description**: Handle call completion (update queue, move to next user, etc.)
**Impact**: Queue state not updated after calls complete
**Implementation**: Need to integrate with queue service to update positions and move to next user

## Medium Priority TODOs

### 4. Performance Optimizations (performance.service.ts:85-86, 102-103)
**Status**: Partial Implementation
**Description**: 
- Reduce API polling rates when page hidden
- Pause non-critical animations
- Restore API polling rates when page visible
- Resume animations
**Impact**: Battery and performance optimization opportunities
**Implementation**: Hook into existing API query configurations and animation systems

### 5. Popup to Page Mode Switching (useGlobalCall.ts:198)
**Status**: Missing Implementation
**Description**: Move call interface from page to popup overlay
**Impact**: Cannot dynamically switch between call modes
**Implementation**: Need to create shared call interface that can be rendered in different containers

## Low Priority TODOs

### 6. Error Reporting Service (GlobalErrorBoundary.tsx:35)
**Status**: Missing Implementation
**Description**: Add error reporting service integration for production
**Impact**: Production errors not automatically reported
**Implementation**: Integrate with service like Sentry, LogRocket, or custom error reporting

## Non-Critical TODOs (Legacy Code)

### 7. Callback Management Modal (CallInterface.tsx:1136)
**Status**: Existing Legacy TODO
**Description**: Open callback management modal
**Impact**: Legacy feature, not related to global Twilio implementation
**Note**: Pre-existing TODO in original codebase

## Implementation Priority Ranking

1. **Critical**: Mute Functionality - Core user experience
2. **High**: Queue ID Mapping - Data integrity
3. **High**: Call Completion Handling - Workflow completion
4. **Medium**: Performance Optimizations - User experience
5. **Medium**: Popup/Page Mode Switching - Feature completeness
6. **Low**: Error Reporting - Production monitoring

## Estimated Implementation Time

- **Mute Functionality**: 2-3 hours
- **Queue ID Mapping**: 1-2 hours  
- **Call Completion Handling**: 4-6 hours
- **Performance Optimizations**: 3-4 hours
- **Popup/Page Mode Switching**: 6-8 hours
- **Error Reporting Service**: 2-3 hours

**Total**: 18-26 hours additional development

## Risk Assessment

- **Low Risk**: All TODOs are enhancements, no blocking issues
- **Core Functionality**: All essential features are implemented and working
- **Graceful Degradation**: System works without these TODOs, they just add polish
- **No Breaking Changes**: All TODOs can be implemented without breaking existing functionality 