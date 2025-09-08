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

const FlowExchangeNode: React.FC<NodeProps> = ({ 
  data
}) => {
  const {
    exchange,
    isInCurrentPath,
    isSelected,
    isLeaf,
    canBranch
  } = data as unknown as FlowExchangeNodeData;

  // Determine opacity based on current path
  const opacity = isInCurrentPath ? "opacity-100" : "opacity-70 hover:opacity-100";
  
  const getUserDisplayContent = () => {
    return exchange.user_summary || exchange.user_content;
  };

  const getAssistantDisplayContent = () => {
    if (exchange.assistant_loading) return "";
    if (!exchange.assistant_content) return "";
    return exchange.assistant_summary || exchange.assistant_content;
  };

  // Base styling - use isSelected from data rather than React Flow's selected
  const containerClasses = `relative w-48 h-24 rounded-md transition-all duration-200 ${opacity} overflow-hidden`;
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
        <div className="h-1/2 flex items-start justify-start p-2 border-b border-primary/20 bg-muted">
          <p className="text-xs leading-tight text-primary font-medium text-left line-clamp-2 overflow-hidden">
            {getUserDisplayContent()}
          </p>
        </div>

        {/* Assistant Section (Bottom Half) */}
        <div className={`h-1/2 flex p-2 bg-background ${
          exchange.assistant_loading ? 'items-center justify-center' : 'items-start justify-start'
        }`}>
          {exchange.assistant_loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-ring border-t-transparent"></div>
          ) : (
            <p className="text-xs leading-tight text-muted-foreground text-left line-clamp-2 overflow-hidden">
              {getAssistantDisplayContent()}
            </p>
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