/**
 * ExchangePreviewDialog - Clean content overlay for previewing exchanges on hover.
 * 
 * Features:
 * - Scoped to ChatInterface only (TreeVisualization remains interactive)
 * - Responsive sizing with max viewport height and scrolling
 * - Shows full user message and assistant response without UI chrome
 * - Fast, subtle animations (150ms duration)
 */
import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ExchangeNode } from '../types/conversation';

export interface ExchangePreviewDialogProps {
  exchange: ExchangeNode | null;
  className?: string;
}

const ExchangePreviewDialog: React.FC<ExchangePreviewDialogProps> = ({ 
  exchange, 
  className = '' 
}) => {
  const scrollableContentRef = useRef<HTMLDivElement>(null);
  
  // Set up scroll event capture when dialog is active
  useEffect(() => {
    if (!exchange) return;

    const handleWheelEvent = (event: WheelEvent) => {
      // Only capture if we have a scrollable content area
      if (!scrollableContentRef.current) return;

      // Prevent the default zoom behavior on React Flow
      event.preventDefault();
      event.stopPropagation();

      // Route the scroll to our dialog content
      const contentElement = scrollableContentRef.current;
      const currentScrollTop = contentElement.scrollTop;
      const maxScroll = contentElement.scrollHeight - contentElement.clientHeight;

      // Calculate new scroll position
      const newScrollTop = Math.max(0, Math.min(maxScroll, currentScrollTop + event.deltaY));

      // Apply the scroll to our content
      contentElement.scrollTop = newScrollTop;
    };

    // Add wheel event listener to document with capture phase to intercept early
    document.addEventListener('wheel', handleWheelEvent, { passive: false, capture: true });

    // Also try adding to window as backup
    window.addEventListener('wheel', handleWheelEvent, { passive: false, capture: true });

    // Cleanup function
    return () => {
      document.removeEventListener('wheel', handleWheelEvent, true);
      window.removeEventListener('wheel', handleWheelEvent, true);
    };
  }, [exchange]); // Re-run when exchange changes (dialog becomes active/inactive)

  if (!exchange) {
    return null;
  }
  
  return (
    <div className={`absolute inset-0 pointer-events-none z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in-0 duration-150 ${className}`}>
      {/* Backdrop - subtle overlay over chat only */}
      <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px] animate-in fade-in-0 duration-150" />
      
      {/* Dialog Container - Now flex to make flex-1 work */}
      <div className="relative w-full max-w-2xl lg:max-w-3xl max-h-[85vh] bg-card border border-border rounded-lg shadow-lg overflow-hidden pointer-events-auto animate-in slide-in-from-bottom-4 fade-in-0 duration-150 ease-out flex flex-col">
        {/* Content - Scrollable */}
        <div ref={scrollableContentRef} className="flex-1 overflow-y-auto min-h-0">
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* User Message */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-3 h-3 rounded-full bg-primary" />
                <span className="text-sm font-medium text-foreground">You</span>
              </div>
              <div className="ml-6 p-3 sm:p-4 rounded-lg bg-secondary/50 border border-secondary">
                <div className="whitespace-pre-wrap break-words text-sm text-secondary-foreground">
                  {exchange.user_content}
                </div>
              </div>
            </div>

            {/* Assistant Response */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className={`flex-shrink-0 w-3 h-3 rounded-full ${
                  exchange.assistant_loading ? 'bg-secondary animate-pulse' : 'bg-secondary'
                }`} />
                <span className="text-sm font-medium text-foreground">Assistant</span>
              </div>
              
              <div className="ml-6">
                {exchange.assistant_loading && !exchange.assistant_content ? (
                  <div className="p-3 sm:p-4 rounded-lg bg-muted/50 border border-muted">
                    <div className="flex items-center space-x-2 text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                      <span className="text-sm italic">Assistant is thinking...</span>
                    </div>
                  </div>
                ) : exchange.assistant_content ? (
                  <div className="p-3 sm:p-4 rounded-lg bg-muted/30 border border-muted">
                    <div className="markdown-content prose prose-sm max-w-none dark:prose-invert text-foreground">
                      <ReactMarkdown>
                        {exchange.assistant_content}
                      </ReactMarkdown>
                      {exchange.assistant_loading && (
                        <div className="inline-flex items-center ml-2 mt-2">
                          <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent"></div>
                          <span className="ml-1 text-xs text-muted-foreground">Streaming...</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 sm:p-4 rounded-lg bg-muted/50 border border-muted">
                    <span className="text-sm text-muted-foreground italic">No response yet</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExchangePreviewDialog;
