/**
 * MessageInput component for sending chat messages.
 * 
 * Provides a text input area and send button for composing and sending
 * messages to the LLM. Handles loading states and keyboard shortcuts.
 */
import React, { useState, KeyboardEvent } from 'react';
import { useConversationStore } from '../store/conversationStore';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { ArrowUp, Square } from 'lucide-react';
import { logger } from '../utils/logger';

export interface MessageInputProps {
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const MessageInput: React.FC<MessageInputProps> = ({ 
  disabled = false,
  placeholder = "Type your message here...",
  className = ''
}) => {
  const [message, setMessage] = useState('');
  const { sendMessage, isLoading, stopGeneration } = useConversationStore();

  const handleSendMessage = async () => {
    if (!message.trim() || disabled) {
      return;
    }

    const messageToSend = message.trim();
    setMessage(''); // Clear input immediately for better UX
    
    try {
      await sendMessage(messageToSend);
    } catch (error) {
      logger.error('Failed to send message:', error);
      // Restore message on error so user can try again
      setMessage(messageToSend);
      // Error is already handled by the store
    }
  };

  const handleButtonClick = async () => {
    if (isLoading) {
      // Stop the generation
      stopGeneration();
    } else {
      // Send the message
      await handleSendMessage();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={`p-2 ${className}`}>
      <div>
        <div className="flex space-x-3 max-w-3xl mx-auto">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "Load a conversation to start chatting..." : placeholder}
            disabled={disabled || isLoading}
            className="flex-1 resize-none min-h-[24px] max-h-[120px]"
            rows={1}
          />
          <Button
            onClick={handleButtonClick}
            disabled={disabled || (!message.trim() && !isLoading)}
            variant="default"
            size="icon"
            className="self-end rounded-full size=sm flex items-center justify-center"
          >
            {isLoading ? (
              <Square className="h-4 w-4"
              fill="currentColor"
              strokeWidth={0} />
            ) : (
              <ArrowUp className="h-4 w-4 stroke-3" />
            )}
          </Button>
        </div>
        <div className="w-full flex justify-center">
          <p className="text-xs text-muted-foreground mt-1">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;
