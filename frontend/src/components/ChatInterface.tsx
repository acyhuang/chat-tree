/**
 * ChatInterface component for displaying conversation threads.
 * 
 * Shows the current conversation path as a linear chat interface
 * with messages from user and assistant displayed chronologically.
 */
import React from 'react';
import { ConversationNode } from '../types/conversation';
import { conversationUtils, useCurrentConversation } from '../store/conversationStore';
import MessageInput from './MessageInput';

export interface ChatInterfaceProps {
  className?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ className = '' }) => {
  const currentConversation = useCurrentConversation();

  // Get the current path nodes for display
  const currentPathNodes = conversationUtils.getCurrentPathNodes(currentConversation);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Chat Header */}
      <div className="flex-shrink-0 p-4 border-b border-border bg-card">
        {currentConversation && (
          <p className="text-sm text-muted-foreground">
            Conversation: {currentConversation.id.slice(0, 8)}... 
            ({currentPathNodes.length} messages)
          </p>
        )}
      </div>

      {/* Messages Area */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${currentPathNodes.length === 0 ? 'bg-muted' : 'bg-background'}`}>
        <div className="max-w-3xl mx-auto h-full">
          {currentPathNodes.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[300px]">
              <div className="text-center text-muted-foreground w-full">
                <p className="text-lg">Start a conversation</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {currentPathNodes.map((node) => (
                <ChatMessage key={node.id} node={node} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Message Input */}
      <div className="flex-shrink-0 border-t border-border bg-card">
        <MessageInput disabled={!currentConversation} />
      </div>
    </div>
  );
};

interface ChatMessageProps {
  node: ConversationNode;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ node }) => {
  const isUser = node.role === 'user';
  const timestamp = new Date(node.metadata.timestamp || Date.now()).toLocaleTimeString();

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[80%]">
        {isUser ? (
          <div className="rounded-lg px-4 py-3 text-left bg-secondary text-secondary-foreground">
            <div className="whitespace-pre-wrap break-words">
              {node.content}
            </div>
          </div>
        ) : (
          <div className="rounded-lg text-left text-foreground">
            <div className="whitespace-pre-wrap break-words">
              {node.content}
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
