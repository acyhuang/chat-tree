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

  // Scroll to position the latest user message at the top of the viewport (one-time only)
  const scrollToLatestUserMessage = useCallback(() => {
    console.log('🎯 SCROLL: Attempting to scroll to latest user message');
    console.log('🎯 SCROLL: messagesContainerRef.current exists:', !!messagesContainerRef.current);
    
    if (messagesContainerRef.current) {
      // Debug DOM structure first
      console.log('🎯 SCROLL: Container innerHTML preview:', messagesContainerRef.current.innerHTML.slice(0, 500) + '...');
      
      const allUserMessages = messagesContainerRef.current.querySelectorAll('[data-role="user"]');
      console.log('🎯 SCROLL: Found user messages:', allUserMessages.length);
      
      // Log details about each user message element
      allUserMessages.forEach((msg, index) => {
        console.log(`🎯 SCROLL: User message ${index}:`, {
          tagName: msg.tagName,
          className: msg.className,
          dataRole: msg.getAttribute('data-role'),
          textPreview: msg.textContent?.slice(0, 50) + '...'
        });
      });
      
      // Try multiple selector methods
      const latestUserMessageOld = messagesContainerRef.current.querySelector('[data-role="user"]:last-of-type');
      const latestUserMessageChild = messagesContainerRef.current.querySelector('[data-role="user"]:last-child');
      const allMessages = messagesContainerRef.current.querySelectorAll('[data-role="user"]');
      const latestUserMessageManual = allMessages.length > 0 ? allMessages[allMessages.length - 1] : null;
      
      console.log('🎯 SCROLL: Selector results:');
      console.log('  - :last-of-type:', !!latestUserMessageOld);
      console.log('  - :last-child:', !!latestUserMessageChild);
      console.log('  - manual selection:', !!latestUserMessageManual);
      
      const latestUserMessage = latestUserMessageManual || latestUserMessageChild || latestUserMessageOld;
      
      if (latestUserMessage) {
        console.log('🎯 SCROLL: Scrolling to pin user message at top');
        latestUserMessage.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      } else {
        console.log('🎯 SCROLL: No user message found - will try polling for element');
        // Try polling with improved selector method
        let attempts = 0;
        const pollForElement = () => {
          attempts++;
          const allMsgs = messagesContainerRef.current?.querySelectorAll('[data-role="user"]');
          const userMsg = allMsgs && allMsgs.length > 0 ? allMsgs[allMsgs.length - 1] : null;
          console.log(`🎯 SCROLL: Polling attempt ${attempts}, found element:`, !!userMsg);
          console.log(`🎯 SCROLL: Polling found ${allMsgs?.length || 0} user messages total`);
          
          if (userMsg) {
            console.log('🎯 SCROLL: Found user message via polling, scrolling');
            userMsg.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else if (attempts < 5) {
            setTimeout(pollForElement, 100);
          } else {
            console.log('🎯 SCROLL: Polling failed, giving up after 5 attempts');
          }
        };
        setTimeout(pollForElement, 100);
      }
    } else {
      console.log('🎯 SCROLL: messagesContainerRef.current is null');
    }
  }, []); // Empty dependency array since function doesn't depend on any props/state

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

  // Auto-scroll when new user message is added (one-time per exchange)
  useEffect(() => {
    console.log('🔄 USEEFFECT: Triggered with currentPathExchanges.length:', currentPathExchanges.length);
    console.log('🔄 USEEFFECT: Exchange IDs:', currentPathExchanges.map(ex => ex.id));
    console.log('🔄 USEEFFECT: lastScrolledExchangeIdRef.current:', lastScrolledExchangeIdRef.current);
    
    if (currentPathExchanges.length > 0) {
      const latestExchange = currentPathExchanges[currentPathExchanges.length - 1];
      const latestExchangeId = latestExchange.id;
      
      console.log('🔄 USEEFFECT: Latest exchange ID:', latestExchangeId);
      console.log('🔄 USEEFFECT: Latest exchange user_content:', latestExchange.user_content?.slice(0, 50) + '...');
      
      // Only scroll if this is a new exchange we haven't scrolled for yet
      if (latestExchangeId !== lastScrolledExchangeIdRef.current) {
        console.log(`🎯 USEEFFECT: NEW EXCHANGE DETECTED! (${latestExchangeId}) - WILL SCROLL`);
        lastScrolledExchangeIdRef.current = latestExchangeId;
        
        // Scroll immediately for new user message (removed loading state checks)
        console.log('🎯 USEEFFECT: Scrolling immediately for new exchange');
        
        // Use requestAnimationFrame + timeout for better DOM synchronization
        requestAnimationFrame(() => {
          setTimeout(() => {
            console.log('🎯 USEEFFECT: Timeout fired, calling scroll function');
            
            try {
              scrollToLatestUserMessage();
              console.log('🎯 USEEFFECT: Scroll call completed successfully');
            } catch (error) {
              console.error('🚨 USEEFFECT: Error calling scrollToLatestUserMessage:', error);
              console.error('🚨 USEEFFECT: Error stack:', error.stack);
            }
          }, 500);
        });
      } else {
        console.log(`🔄 USEEFFECT: Same exchange (${latestExchangeId}), skipping scroll`);
      }
    } else {
      console.log('🔄 USEEFFECT: No exchanges found');
    }
  }, [currentExchangeTree, currentPathExchanges.length]); // Changed dependencies to be more reliable

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
      <div ref={messagesContainerRef} className={`flex-1 overflow-y-auto p-4 space-y-4 ${messages.length === 0 ? 'bg-muted' : 'bg-background'}`}>
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