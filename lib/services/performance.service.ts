/**
 * Performance Optimization Service for Global Twilio System
 * 
 * Handles:
 * - Memory management and cleanup
 * - Service lifecycle optimization
 * - Performance monitoring
 * - Resource pooling
 */

export class PerformanceService {
  private static instance: PerformanceService;
  private cleanupTasks: (() => void)[] = [];
  private memoryMonitor: NodeJS.Timeout | null = null;
  private performanceMetrics: Map<string, number> = new Map();

  private constructor() {
    this.initializePerformanceMonitoring();
  }

  static getInstance(): PerformanceService {
    if (!PerformanceService.instance) {
      PerformanceService.instance = new PerformanceService();
    }
    return PerformanceService.instance;
  }

  /**
   * Initialize performance monitoring
   */
  private initializePerformanceMonitoring() {
    if (typeof window !== 'undefined') {
      // Browser environment - monitor memory usage
      this.memoryMonitor = setInterval(() => {
        this.checkMemoryUsage();
      }, 30000); // Check every 30 seconds

      // Monitor page lifecycle events
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });

      // Monitor visibility changes for optimization
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.onPageHidden();
        } else {
          this.onPageVisible();
        }
      });
    }
  }

  /**
   * Check memory usage and trigger cleanup if needed
   */
  private checkMemoryUsage() {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      const usedMB = memInfo.usedJSHeapSize / 1024 / 1024;
      const limitMB = memInfo.jsHeapSizeLimit / 1024 / 1024;
      const usagePercent = (usedMB / limitMB) * 100;

      this.performanceMetrics.set('memoryUsageMB', usedMB);
      this.performanceMetrics.set('memoryUsagePercent', usagePercent);

      console.log(`🔍 Memory usage: ${usedMB.toFixed(1)}MB (${usagePercent.toFixed(1)}%)`);

      // Trigger cleanup if memory usage is high
      if (usagePercent > 80) {
        console.warn('⚠️ High memory usage detected, triggering cleanup');
        this.forceCleanup();
      }
    }
  }

  /**
   * Optimize for when page becomes hidden
   */
  private onPageHidden() {
    console.log('📱 Page hidden - reducing resource usage');
    
    // Reduce polling frequency for background processes
    this.performanceMetrics.set('pageHidden', Date.now());
    
    // TODO: Reduce API polling rates
    // TODO: Pause non-critical animations
  }

  /**
   * Restore performance when page becomes visible
   */
  private onPageVisible() {
    console.log('👁️ Page visible - restoring normal operations');
    
    const hiddenTime = this.performanceMetrics.get('pageHidden');
    if (hiddenTime) {
      const hiddenDuration = Date.now() - hiddenTime;
      console.log(`📊 Page was hidden for ${hiddenDuration}ms`);
      this.performanceMetrics.delete('pageHidden');
    }
    
    // TODO: Restore API polling rates
    // TODO: Resume animations
  }

  /**
   * Register a cleanup task
   */
  registerCleanupTask(task: () => void): void {
    this.cleanupTasks.push(task);
  }

  /**
   * Force immediate cleanup
   */
  forceCleanup(): void {
    console.log('🧹 Performing forced cleanup');
    
    // Run all registered cleanup tasks
    this.cleanupTasks.forEach(task => {
      try {
        task();
      } catch (error) {
        console.error('❌ Cleanup task failed:', error);
      }
    });

    // Clear metrics older than 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [key, value] of this.performanceMetrics.entries()) {
      if (typeof value === 'number' && value < fiveMinutesAgo) {
        this.performanceMetrics.delete(key);
      }
    }

    // Force garbage collection if available
    if ('gc' in window) {
      (window as any).gc();
      console.log('♻️ Forced garbage collection');
    }
  }

  /**
   * Measure operation performance
   */
  measurePerformance<T>(operation: string, fn: () => T): T {
    const startTime = performance.now();
    
    try {
      const result = fn();
      
      // Handle promises
      if (result instanceof Promise) {
        return result.then(value => {
          const endTime = performance.now();
          const duration = endTime - startTime;
          this.recordMetric(`${operation}_duration`, duration);
          
          if (duration > 1000) {
            console.warn(`⚠️ Slow operation: ${operation} took ${duration.toFixed(2)}ms`);
          }
          
          return value;
        }) as T;
      }
      
      // Handle synchronous operations
      const endTime = performance.now();
      const duration = endTime - startTime;
      this.recordMetric(`${operation}_duration`, duration);
      
      if (duration > 100) {
        console.warn(`⚠️ Slow operation: ${operation} took ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      this.recordMetric(`${operation}_error`, 1);
      throw error;
    }
  }

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number): void {
    this.performanceMetrics.set(name, value);
    
    // Log significant metrics
    if (name.includes('duration') && value > 1000) {
      console.log(`📊 Performance metric: ${name} = ${value.toFixed(2)}ms`);
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.performanceMetrics.entries());
  }

  /**
   * Optimize Twilio device management
   */
  optimizeTwilioDevice(device: any): void {
    if (!device) return;

    // Register cleanup for device
    this.registerCleanupTask(() => {
      try {
        if (device.state !== 'destroyed') {
          console.log('🎧 Cleaning up Twilio device');
          device.destroy();
        }
      } catch (error) {
        console.error('❌ Failed to cleanup Twilio device:', error);
      }
    });

    // Monitor device events for performance
    device.on('ready', () => {
      this.recordMetric('twilio_device_ready', Date.now());
    });

    device.on('error', (error: any) => {
      this.recordMetric('twilio_device_error', Date.now());
      console.error('🎧 Twilio device error:', error);
    });
  }

  /**
   * Throttle function calls to prevent excessive API requests
   */
  throttle<T extends (...args: any[]) => any>(
    fn: T, 
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        return fn(...args);
      }
    };
  }

  /**
   * Debounce function calls to prevent rapid successive calls
   */
  debounce<T extends (...args: any[]) => any>(
    fn: T, 
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    console.log('🧹 PerformanceService cleanup');
    
    // Clear memory monitor
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
      this.memoryMonitor = null;
    }

    // Run all cleanup tasks
    this.forceCleanup();
    this.cleanupTasks = [];
    this.performanceMetrics.clear();
  }

  /**
   * Get system performance summary
   */
  getPerformanceSummary(): {
    memoryUsageMB: number;
    memoryUsagePercent: number;
    metricsCount: number;
    cleanupTasksCount: number;
    recommendations: string[];
  } {
    const memoryUsageMB = this.performanceMetrics.get('memoryUsageMB') || 0;
    const memoryUsagePercent = this.performanceMetrics.get('memoryUsagePercent') || 0;
    
    const recommendations: string[] = [];
    
    if (memoryUsagePercent > 70) {
      recommendations.push('Consider reducing memory usage or refreshing the page');
    }
    
    if (this.cleanupTasks.length > 10) {
      recommendations.push('Many cleanup tasks registered - consider optimizing resource management');
    }
    
    return {
      memoryUsageMB: Number(memoryUsageMB.toFixed(1)),
      memoryUsagePercent: Number(memoryUsagePercent.toFixed(1)),
      metricsCount: this.performanceMetrics.size,
      cleanupTasksCount: this.cleanupTasks.length,
      recommendations
    };
  }
}

// Export singleton instance
export const performanceService = PerformanceService.getInstance(); 