/**
 * ChatInterface component for displaying conversation threads.
 * 
 * Shows the current conversation path as a linear chat interface
 * with messages from user and assistant displayed chronologically.
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useCurrentExchangeTree, usePreviewExchange } from '../store/conversationStore';
import MessageInput from './MessageInput';
import ExchangePreviewDialog from './ExchangePreviewDialog';
import { logger } from '../utils/logger';

export interface ChatInterfaceProps {
  className?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ className = '' }) => {
  const currentExchangeTree = useCurrentExchangeTree();
  const previewExchange = usePreviewExchange();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef<boolean>(false);
  
  // Pin-to-top functionality refs and state
  const lastProcessedUserMessageRef = useRef<string | null>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const [spacerHeight, setSpacerHeight] = useState<number>(0);

  // Check if user has scrolled up from bottom
  const checkUserScrollPosition = useCallback(() => {
    if (!messagesContainerRef.current) return;
    
    const container = messagesContainerRef.current;
    const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 50; // 50px threshold
    userScrolledUpRef.current = !isAtBottom;
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

  // Add scroll listener to detect user manual scrolling
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      checkUserScrollPosition();
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [checkUserScrollPosition]);

  // Pin-to-top: Detect new user messages and handle pin-to-top behavior
  useEffect(() => {
    if (messages.length === 0) return;
    
    // Find the most recent user message, regardless of position
    const userMessages = messages.filter(msg => msg.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];
    const isNewUserMessage = lastUserMessage && 
      lastUserMessage.id !== lastProcessedUserMessageRef.current;
    
    if (isNewUserMessage && messagesContainerRef.current) {
      // Calculate spacer height (viewport + buffer)
      const container = messagesContainerRef.current;
      const viewportHeight = container.clientHeight;
      const newSpacerHeight = viewportHeight;
      
      // Update spacer height
      setSpacerHeight(newSpacerHeight);
      
      // Update tracking ref
      lastProcessedUserMessageRef.current = lastUserMessage.id;
      
      // Pin to top after DOM update
      setTimeout(() => {
        if (messagesContainerRef.current) {
          // Find the user message element and scroll it to the top
          const userMessageElements = messagesContainerRef.current.querySelectorAll('[data-role="user"]');
          const lastUserMessageElement = userMessageElements[userMessageElements.length - 1] as HTMLElement;
          
          if (lastUserMessageElement) {
            const container = messagesContainerRef.current;
            const targetScrollTop = lastUserMessageElement.offsetTop - 16; // 16px padding from top
            
            container.scrollTo({
              top: targetScrollTop,
              behavior: 'smooth'
            });
          }
        }
      }, 100);
    }
  }, [messages]);

  return (
    <div className={`flex flex-col h-full ${className} relative`}>
      {/* Chat Header */}
      {/* <div className="flex-shrink-0 p-4 border-b border-border bg-card">
        {currentExchangeTree && (
          <p className="text-sm text-muted-foreground">
            Conversation: {currentExchangeTree.id.slice(0, 8)}... 
            ({currentPathExchanges.length} exchanges, {messages.length} messages)
          </p>
        )}
      </div> */}

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
              {/* Dynamic spacer for pin-to-top functionality */}
              {spacerHeight > 0 && (
                <div 
                  ref={spacerRef}
                  style={{ height: `${spacerHeight}px` }}
                  className="w-full"
                  aria-hidden="true"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Message Input */}
      <div className="flex-shrink-0 border-t border-border bg-card">
        <MessageInput disabled={!currentExchangeTree} />
      </div>

      {/* Exchange Preview Dialog Overlay */}
      <ExchangePreviewDialog exchange={previewExchange} />
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