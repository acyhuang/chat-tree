/**
 * ChatInterface component for displaying conversation threads.
 * 
 * Shows the current conversation path as a linear chat interface
 * with messages from user and assistant displayed chronologically.
 */
import React from 'react';
import { ExchangeNode } from '../types/conversation';
import { useCurrentExchangeTree } from '../store/conversationStore';
import MessageInput from './MessageInput';

export interface ChatInterfaceProps {
  className?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ className = '' }) => {
  const currentExchangeTree = useCurrentExchangeTree();

  // Get the current path exchanges for display
  const currentPathExchanges = currentExchangeTree 
    ? currentExchangeTree.current_path.map(id => currentExchangeTree.exchanges[id]).filter(Boolean)
    : [];

  // Convert exchanges to individual messages for display
  const messages: Array<{ id: string; content: string; role: 'user' | 'assistant'; timestamp: string; exchangeId: string }> = [];
  
  currentPathExchanges.forEach(exchange => {
    // Add user message
    messages.push({
      id: `${exchange.id}-user`,
      content: exchange.user_content,
      role: 'user',
      timestamp: exchange.metadata.timestamp || new Date().toISOString(),
      exchangeId: exchange.id
    });
    
    // Add assistant message if available
    if (exchange.assistant_content && exchange.is_complete) {
      messages.push({
        id: `${exchange.id}-assistant`,
        content: exchange.assistant_content,
        role: 'assistant',
        timestamp: exchange.metadata.timestamp || new Date().toISOString(),
        exchangeId: exchange.id
      });
    } else if (exchange.assistant_loading) {
      // Show loading state
      messages.push({
        id: `${exchange.id}-assistant-loading`,
        content: '...',
        role: 'assistant',
        timestamp: exchange.metadata.timestamp || new Date().toISOString(),
        exchangeId: exchange.id
      });
    }
  });

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
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${messages.length === 0 ? 'bg-muted' : 'bg-background'}`}>
        <div className="max-w-3xl mx-auto h-full">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[300px]">
              <div className="text-center text-muted-foreground w-full">
                <p className="text-lg">Start a conversation</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
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
  };
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const timestamp = new Date(message.timestamp).toLocaleTimeString();

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[80%]">
        {isUser ? (
          <div className="rounded-lg px-4 py-3 text-left bg-secondary text-secondary-foreground">
            <div className="whitespace-pre-wrap break-words">
              {message.content}
            </div>
          </div>
        ) : (
          <div className="rounded-lg text-left text-foreground">
            <div className="whitespace-pre-wrap break-words">
              {message.content === '...' ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  <span className="italic">Assistant is thinking...</span>
                </div>
              ) : (
                message.content
              )}
            </div>
          </div>
        )}
        <div className={`mt-1 text-xs font-medium text-muted-foreground ${isUser ? 'text-right' : 'text-left'}`}>
          {isUser ? 'You' : 'Assistant'} • {timestamp}
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;