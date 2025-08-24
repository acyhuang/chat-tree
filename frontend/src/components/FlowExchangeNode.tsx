/**
 * FlowExchangeNode - Custom React Flow node component for conversation exchanges.
 * 
 * Replaces the custom TreeNode component with React Flow integration.
 * Maintains the same visual design and interaction patterns.
 */
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { ExchangeNode } from '../types/conversation';

export interface FlowExchangeNodeData {
  exchange: ExchangeNode;
  isInCurrentPath: boolean;
  isSelected: boolean;
  isLeaf: boolean;
  canBranch: boolean;
  level: number;
}

const FlowExchangeNode: React.FC<NodeProps<FlowExchangeNodeData>> = ({ 
  data, 
  selected 
}) => {
  const {
    exchange,
    isInCurrentPath,
    isSelected,
    isLeaf,
    canBranch,
    level
  } = data;

  // Determine opacity based on current path
  const opacity = isInCurrentPath ? "opacity-100" : "opacity-50 hover:opacity-100";
  
  // Truncate content for display
  const truncateContent = (content: string, maxLength: number = 20) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength - 3) + '...';
  };

  const getUserDisplayContent = () => {
    return truncateContent(exchange.user_summary || exchange.user_content);
  };

  const getAssistantDisplayContent = () => {
    if (exchange.assistant_loading) return "";
    if (!exchange.assistant_content) return "";
    return truncateContent(exchange.assistant_summary || exchange.assistant_content);
  };

  // Base styling - use isSelected from data rather than React Flow's selected
  const containerClasses = `relative w-32 h-20 rounded-md transition-all duration-200 ${opacity}`;
  const borderClasses = isSelected 
    ? "ring-2 ring-ring" 
    : "border-2 border-ring/20 hover:border-ring/50";

  return (
    <div className="relative">
      {/* Handles for React Flow connections */}
      <Handle
        type="target"
        position={Position.Top}
        className="opacity-0"
        style={{ top: -5 }}
      />
      
      {/* Exchange Node */}
      <div className={`${containerClasses} ${borderClasses}`}>
        {/* User Section (Top Half) */}
        <div className="h-1/2 flex items-center left-align px-2 border-b border-primary/20 bg-background rounded-t-md">
          <span className="text-xs leading-tight text-primary font-medium text-left">
            {getUserDisplayContent()}
          </span>
        </div>

        {/* Assistant Section (Bottom Half) */}
        <div className="h-1/2 flex items-center left-align px-2 bg-muted rounded-b-md">
          {exchange.assistant_loading ? (
            <div className="flex items-center space-x-1">
              <div className="w-1 h-1 bg-secondary rounded-full animate-pulse" />
              <div className="w-1 h-1 bg-secondary rounded-full animate-pulse" style={{ animationDelay: '0.1s' }} />
              <div className="w-1 h-1 bg-secondary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
            </div>
          ) : (
            <span className="text-xs leading-tight text-muted-foreground text-left">
              {getAssistantDisplayContent()}
            </span>
          )}
        </div>
      </div>

      {/* Branch indicator (+badge) */}
      {canBranch && isSelected && (
        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-full bg-muted-foreground flex items-center justify-center">
          <Plus className="w-3 h-3 text-muted" strokeWidth={3} />
        </div>
      )}

      {/* Handle for outgoing connections - only show if not a leaf */}
      {!isLeaf && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="opacity-0"
          style={{ bottom: -5 }}
        />
      )}
    </div>
  );
};

export default FlowExchangeNode;