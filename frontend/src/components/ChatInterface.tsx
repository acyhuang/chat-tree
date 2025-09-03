/**
 * ChatInterface component for displaying conversation threads.
 * 
 * Shows the current conversation path as a linear chat interface
 * with messages from user and assistant displayed chronologically.
 */
import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { useCurrentExchangeTree } from '../store/conversationStore';
import MessageInput from './MessageInput';
// Logger import removed - not currently used

export interface ChatInterfaceProps {
  className?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ className = '' }) => {
  const currentExchangeTree = useCurrentExchangeTree();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastScrolledExchangeIdRef = useRef<string | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [isPinToTopActive, setIsPinToTopActive] = useState(false);
  const [shouldMaintainPosition, setShouldMaintainPosition] = useState(false);
  const lastUserMessageElementRef = useRef<Element | null>(null);

  // Find the latest user message element reliably
  const findLatestUserMessage = useCallback((): Element | null => {
    if (!messagesContainerRef.current) return null;
    
    const allUserMessages = messagesContainerRef.current.querySelectorAll('[data-role="user"]');
    return allUserMessages.length > 0 ? allUserMessages[allUserMessages.length - 1] : null;
  }, []);

  // Pin the user message to the top of the viewport
  const pinUserMessageToTop = useCallback((userMessage: Element, behavior: ScrollBehavior = 'smooth') => {
    // Removed verbose logging
    
    const container = messagesContainerRef.current;
    if (!container) return;

    // Calculate the exact position needed to pin the message at the top
    const containerRect = container.getBoundingClientRect();
    const messageRect = userMessage.getBoundingClientRect();
    
    // Scroll to position the user message at the top of the container
    const currentScrollTop = container.scrollTop;
    const targetScrollTop = currentScrollTop + (messageRect.top - containerRect.top);
    
    // Removed verbose logging
    
    container.scrollTo({
      top: targetScrollTop,
      behavior
    });
  }, []);

  // Maintain scroll position during streaming
  const maintainUserMessagePosition = useCallback(() => {
    if (!shouldMaintainPosition || !lastUserMessageElementRef.current) return;
    
    // Removed verbose logging
    // Use instant scrolling during streaming to avoid conflicts
    pinUserMessageToTop(lastUserMessageElementRef.current, 'instant');
  }, [shouldMaintainPosition, pinUserMessageToTop]);

  // Initialize pin-to-top for new user message
  const initiatePinToTop = useCallback(() => {
    // Removed verbose logging
    
    const userMessage = findLatestUserMessage();
    if (!userMessage) {
      // Removed verbose logging
      // Use requestAnimationFrame for better DOM timing
      requestAnimationFrame(() => {
        const retryMessage = findLatestUserMessage();
        if (retryMessage) {
          // Removed verbose logging
          lastUserMessageElementRef.current = retryMessage;
          setIsPinToTopActive(true);
          setShouldMaintainPosition(true);
          pinUserMessageToTop(retryMessage, 'smooth');
        } else {
          // Removed verbose logging
        }
      });
      return;
    }
    
    // Removed verbose logging
    lastUserMessageElementRef.current = userMessage;
    setIsPinToTopActive(true);
    setShouldMaintainPosition(true);
    pinUserMessageToTop(userMessage, 'smooth');
  }, [findLatestUserMessage, pinUserMessageToTop]);

  // Get the current path exchanges for display
  const currentPathExchanges = currentExchangeTree 
    ? currentExchangeTree.current_path.map(id => currentExchangeTree.exchanges[id]).filter(Boolean)
    : [];

  // Convert exchanges to individual messages for display
  const messages: Array<{ id: string; content: string; role: 'user' | 'assistant'; timestamp: string; exchangeId: string; isLoading?: boolean }> = [];
  
  currentPathExchanges.forEach(exchange => {
    // Add user message
    messages.push({
      id: `${exchange.id}-user`,
      content: exchange.user_content,
      role: 'user',
      timestamp: exchange.metadata.timestamp || new Date().toISOString(),
      exchangeId: exchange.id
    });
    
    // Add assistant message if there's content OR if it's loading
    if (exchange.assistant_content || exchange.assistant_loading) {
      messages.push({
        id: `${exchange.id}-assistant`,
        content: exchange.assistant_content || '',
        role: 'assistant',
        timestamp: exchange.metadata.timestamp || new Date().toISOString(),
        exchangeId: exchange.id,
        isLoading: exchange.assistant_loading && !exchange.is_complete
      });
    }
  });

  // Detect when exchanges have streaming content
  const hasStreamingContent = useMemo(() => {
    return currentPathExchanges.some(ex => ex.assistant_loading && !ex.is_complete);
  }, [currentPathExchanges]);

  // Setup ResizeObserver to maintain scroll position during streaming
  useEffect(() => {
    if (!shouldMaintainPosition || !messagesContainerRef.current) return;
    
    // Removed verbose logging
    
    const container = messagesContainerRef.current;
    const observer = new ResizeObserver((_entries) => {
      // Removed verbose logging
      // Small delay to ensure DOM has settled
      requestAnimationFrame(() => {
        maintainUserMessagePosition();
      });
    });
    
    // Observe the messages container for size changes
    observer.observe(container);
    resizeObserverRef.current = observer;
    
    return () => {
      // Removed verbose logging
      observer.disconnect();
      resizeObserverRef.current = null;
    };
  }, [shouldMaintainPosition, maintainUserMessagePosition]);

  // Stop maintaining position when streaming completes
  useEffect(() => {
    if (!hasStreamingContent && shouldMaintainPosition) {
      // Removed verbose logging
      setShouldMaintainPosition(false);
      setIsPinToTopActive(false);
      lastUserMessageElementRef.current = null;
    }
  }, [hasStreamingContent, shouldMaintainPosition]);

  // Auto-scroll when new user message is added
  useEffect(() => {
    // Removed verbose logging
    
    if (currentPathExchanges.length === 0) {
      // Removed verbose logging
      setIsPinToTopActive(false);
      setShouldMaintainPosition(false);
      lastUserMessageElementRef.current = null;
      return;
    }
    
    const latestExchange = currentPathExchanges[currentPathExchanges.length - 1];
    const latestExchangeId = latestExchange.id;
    
    // Only process new exchanges
    if (latestExchangeId === lastScrolledExchangeIdRef.current) {
      // Removed verbose logging
      return;
    }
    
    // Removed verbose logging
    
    lastScrolledExchangeIdRef.current = latestExchangeId;
    
    // Reset previous state and initiate new pin-to-top
    setIsPinToTopActive(false);
    setShouldMaintainPosition(false);
    lastUserMessageElementRef.current = null;
    
    // Use a small delay to ensure DOM has updated with the new message
    requestAnimationFrame(() => {
      setTimeout(() => {
        initiatePinToTop();
      }, 50); // Much shorter delay for better responsiveness
    });
  }, [currentPathExchanges.length, initiatePinToTop]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Chat Header */}
      <div className="flex-shrink-0 p-4 border-b border-border bg-card">
        {currentExchangeTree && (
          <p className="text-sm text-muted-foreground">
            Conversation: {currentExchangeTree.id.slice(0, 8)}... 
            ({currentPathExchanges.length} exchanges, {messages.length} messages)
          </p>
        )}
      </div>

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef} 
        className={`flex-1 overflow-y-auto p-4 space-y-4 ${messages.length === 0 ? 'bg-muted' : 'bg-background'} ${isPinToTopActive ? 'scroll-smooth' : ''}`}
      >
        <div className="max-w-3xl mx-auto h-full">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[300px]">
              <div className="text-center text-muted-foreground w-full">
                <p className="text-lg">Start a conversation</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-6">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Message Input */}
      <div className="flex-shrink-0 border-t border-border bg-card">
        <MessageInput disabled={!currentExchangeTree} />
      </div>
    </div>
  );
};

interface ChatMessageProps {
  message: {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: string;
    exchangeId: string;
    isLoading?: boolean;
  };
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const timestamp = new Date(message.timestamp).toLocaleTimeString();

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`} data-role={message.role}>
      <div className="max-w-[80%]">
        {isUser ? (
          <div className="rounded-lg px-4 py-3 text-left bg-secondary text-secondary-foreground">
            <div className="whitespace-pre-wrap break-words">
              {message.content}
            </div>
          </div>
        ) : (
          <div className="rounded-lg px-4 py-3 text-left text-foreground">
            {message.isLoading && !message.content ? (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
              </div>
            ) : (
              <div className="markdown-content prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>
                  {message.content}
                </ReactMarkdown>
                {message.isLoading && (
                  <div className="inline-flex items-center ml-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent"></div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {(isUser || !message.isLoading) && (
          <div className={`mt-1 text-xs font-medium text-muted-foreground ${isUser ? 'text-right' : 'text-left'}`}>
            {isUser ? 'You' : 'Assistant'} • {timestamp}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;