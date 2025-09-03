/**
 * ChatInterface component for displaying conversation threads.
 * 
 * Shows the current conversation path as a linear chat interface
 * with messages from user and assistant displayed chronologically.
 */
import React, { useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useCurrentExchangeTree } from '../store/conversationStore';
import MessageInput from './MessageInput';

export interface ChatInterfaceProps {
  className?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ className = '' }) => {
  const currentExchangeTree = useCurrentExchangeTree();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastScrolledExchangeIdRef = useRef<string | null>(null);
  const userHasScrolledRef = useRef<boolean>(false);

  // Find the latest user message element
  const findLatestUserMessage = useCallback((): Element | null => {
    if (!messagesContainerRef.current) return null;
    
    const allUserMessages = messagesContainerRef.current.querySelectorAll('[data-role="user"]');
    return allUserMessages.length > 0 ? allUserMessages[allUserMessages.length - 1] : null;
  }, []);

  // Scroll to the latest user message at the top of the viewport
  const scrollToLatestUserMessage = useCallback(() => {
    const userMessage = findLatestUserMessage();
    if (!userMessage) {
      // If message not found immediately, retry after DOM update
      requestAnimationFrame(() => {
        const retryMessage = findLatestUserMessage();
        if (retryMessage) {
          retryMessage.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      });
      return;
    }
    
    userMessage.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'start' 
    });
  }, [findLatestUserMessage]);

  // Detect manual scrolling by user
  const handleScroll = useCallback(() => {
    userHasScrolledRef.current = true;
  }, []);

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

  // Setup scroll event listener to detect manual scrolling
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Auto-scroll to user message when new exchange is added
  useEffect(() => {
    if (currentPathExchanges.length === 0) {
      lastScrolledExchangeIdRef.current = null;
      return;
    }
    
    const latestExchange = currentPathExchanges[currentPathExchanges.length - 1];
    const latestExchangeId = latestExchange.id;
    
    // Only process new exchanges
    if (latestExchangeId === lastScrolledExchangeIdRef.current) {
      return;
    }
    
    lastScrolledExchangeIdRef.current = latestExchangeId;
    
    // Reset manual scroll flag for new message
    userHasScrolledRef.current = false;
    
    // Scroll to the new user message after DOM update
    requestAnimationFrame(() => {
      setTimeout(() => {
        // Only auto-scroll if user hasn't manually scrolled
        if (!userHasScrolledRef.current) {
          scrollToLatestUserMessage();
        }
      }, 50);
    });
  }, [currentPathExchanges.length, scrollToLatestUserMessage]);

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
        className={`flex-1 overflow-y-auto p-4 space-y-4 ${messages.length === 0 ? 'bg-muted' : 'bg-background'}`}
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