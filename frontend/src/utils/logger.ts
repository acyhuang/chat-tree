/**
 * Frontend logging utility with environment-based log levels
 */

// Check for debug mode via environment or global flag
const isDebugMode = process.env.NODE_ENV === 'development' || 
                   (typeof window !== 'undefined' && (window as any).DEBUG === true);

export const logger = {
  /**
   * Error logs - always shown
   */
  error: (message: string, ...args: any[]) => {
    console.error(`❌ ${message}`, ...args);
  },

  /**
   * Warning logs - always shown  
   */
  warn: (message: string, ...args: any[]) => {
    console.warn(`⚠️ ${message}`, ...args);
  },

  /**
   * Info logs - key milestones, shown in development
   */
  info: (message: string, ...args: any[]) => {
    if (isDebugMode) {
      console.log(`${message}`, ...args);
    }
  },

  /**
   * Debug logs - detailed flow, only when explicitly debugging
   */ 
  debug: (message: string, ...args: any[]) => {
    if (isDebugMode && (window as any).VERBOSE_DEBUG === true) {
      console.log(`🔍 ${message}`, ...args);
    }
  },

  /**
   * Enable verbose debugging at runtime
   */
  enableVerboseDebug: () => {
    if (typeof window !== 'undefined') {
      (window as any).VERBOSE_DEBUG = true;
      console.log('🔧 Verbose debugging enabled. Use logger.disableVerboseDebug() to turn off.');
    }
  },

  /**
   * Disable verbose debugging at runtime
   */
  disableVerboseDebug: () => {
    if (typeof window !== 'undefined') {
      (window as any).VERBOSE_DEBUG = false;
      console.log('🔧 Verbose debugging disabled.');
    }
  }
};

// Make logger available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).logger = logger;
}
