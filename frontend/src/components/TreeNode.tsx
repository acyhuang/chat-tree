/**
 * TreeNode component for rendering individual nodes in the conversation tree.
 * 
 * Features:
 * - Visual differentiation for user vs assistant messages
 * - Current path highlighting
 * - Leaf node indicators
 * - Hover and click interactions
 * - Compact display with message summary
 */
import React from 'react';
import { Plus } from 'lucide-react';
import { ExchangeNode } from '../types/conversation';

export interface TreeNodeProps {
  exchange: ExchangeNode;
  isInCurrentPath: boolean;
  isSelected: boolean;
  isLeaf: boolean;
  canBranch: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  exchange,
  isInCurrentPath,
  isSelected,
  isLeaf,
  canBranch,
  onClick,
  onMouseEnter,
  onMouseLeave
}) => {
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

  // Base styling
  const containerClasses = `relative w-32 h-20 rounded-md cursor-pointer transition-all duration-200 ${opacity}`;
  const borderClasses = isSelected 
    ? "ring-2 ring-ring" 
    : "border-2 border-ring/20 hover:border-ring/50";

  return (
    <div className="relative">
      {/* Exchange Node */}
      <div
        className={`${containerClasses} ${borderClasses}`}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
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
    </div>
  );
};

export default TreeNode;
