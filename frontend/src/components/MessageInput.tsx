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
  const { sendMessage, isLoading } = useConversationStore();

  const handleSendMessage = async () => {
    if (!message.trim() || disabled || isLoading) {
      return;
    }

    const messageToSend = message.trim();
    setMessage(''); // Clear input immediately for better UX
    
    try {
      await sendMessage(messageToSend);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Restore message on error so user can try again
      setMessage(messageToSend);
      // Error is already handled by the store
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
            className="flex-1 resize-none min-h-[44px] max-h-[120px]"
            rows={3}
          />
          <Button
            onClick={handleSendMessage}
            disabled={disabled || isLoading || !message.trim()}
            variant="default"
            size="default"
            className="self-end"
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Sending...</span>
              </div>
            ) : (
              'Send'
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
