/**
 * TreeVisualization component for displaying conversation trees.
 * 
 * Features:
 * - Vertical layout with root at top
 * - Pan/zoom functionality via React Flow
 * - Global exchange preview via hover
 * - Context switching on node click
 * - Visual indicators for current path and branching
 */
import React, { useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useReactFlow,
  ReactFlowProvider,
  Node
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { conversationUtils, useCurrentExchangeTree, useConversationStore } from '../store/conversationStore';
import { logger } from '../utils/logger';
import FlowExchangeNode from './FlowExchangeNode';
import { transformExchangeTreeToFlow, updateNodeStyles, FlowExchangeNode as FlowExchangeNodeType } from '../utils/treeToFlow';
import { Badge } from './ui/badge';

export interface TreeVisualizationProps {
  className?: string;
}

// Define custom node types for React Flow
const nodeTypes = {
  exchangeNode: FlowExchangeNode as any
};

// Internal component that uses React Flow hooks
const TreeVisualizationFlow: React.FC<TreeVisualizationProps> = ({ className = '' }) => {
  // ALL HOOKS FIRST - must be called in the same order every render
  const { setCurrentPath, setPreviewExchange } = useConversationStore();
  const exchangeTree = useCurrentExchangeTree();
  const reactFlowInstance = useReactFlow();

  // Transform exchange tree to React Flow format
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!exchangeTree) {
      return { nodes: [], edges: [] };
    }
    const result = transformExchangeTreeToFlow(exchangeTree);
    return result;
  }, [exchangeTree]);

  // Update node styles when current path changes
  const { nodes, edges } = useMemo(() => {
    if (!exchangeTree || initialNodes.length === 0) {
      return { nodes: initialNodes, edges: initialEdges };
    }
    const result = updateNodeStyles(initialNodes, initialEdges, exchangeTree);
    return result;
  }, [initialNodes, initialEdges, exchangeTree]);

  // Handle node clicks
  const handleNodeClick = useCallback(async (_event: React.MouseEvent, node: Node) => {
    if (!exchangeTree) return;
    
    const exchangeId = node.id;
    const exchange = exchangeTree.exchanges[exchangeId];
    if (!exchange) return;
    
    // Use the exchange ID directly for navigation in exchange-based system
    try {
      await setCurrentPath(exchangeId);
    } catch (error) {
      logger.error('Failed to set current path:', error);
    }
  }, [exchangeTree, setCurrentPath]);

  // Handle node hover for preview
  const handleNodeMouseEnter = useCallback((_event: React.MouseEvent, node: Node) => {
    const flowNode = node as FlowExchangeNodeType;
    setPreviewExchange(flowNode.data.exchange);
  }, [setPreviewExchange]);

  const handleNodeMouseLeave = useCallback(() => {
    setPreviewExchange(null);
  }, [setPreviewExchange]);

  // Handle centering on selected node
  const centerOnSelectedNode = useCallback(() => {
    if (!reactFlowInstance || !exchangeTree) return;
    
    const selectedId = exchangeTree.current_path.length > 0 
      ? exchangeTree.current_path[exchangeTree.current_path.length - 1]
      : exchangeTree.root_id;
    
    if (selectedId) {
      const node = nodes.find(n => n.id === selectedId);
      if (node) {
        reactFlowInstance.fitView({
          nodes: [node],
          duration: 300,
          padding: 0.3 // 30% padding around the node
        });
      }
    }
  }, [reactFlowInstance, exchangeTree, nodes]);

  // Center on selected node when path changes
  useEffect(() => {
    if (exchangeTree && nodes.length > 0) {
      // Small delay to ensure React Flow has rendered the nodes
      const timeoutId = setTimeout(() => {
        centerOnSelectedNode();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [exchangeTree?.current_path, nodes.length, centerOnSelectedNode]);

  // Initial centering when component mounts
  useEffect(() => {
    if (reactFlowInstance && nodes.length > 0) {
      const timeoutId = setTimeout(() => {
        centerOnSelectedNode();
      }, 250);

      return () => clearTimeout(timeoutId);
    }
  }, [reactFlowInstance, nodes.length, centerOnSelectedNode]);

  // CONDITIONAL RENDERING AFTER ALL HOOKS
  if (!exchangeTree) {
    return (
      <div className={`flex items-center justify-center h-full bg-muted ${className}`}>
        <div className="text-center text-muted-foreground">
          <p className="text-lg">No conversation loaded</p>
          <p className="text-sm">Create a conversation to view the tree</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-muted ${className}`}>
      {/* Tree Visualization */}
      <div className="flex-1 relative overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          fitView
          fitViewOptions={{
            padding: 0.2,
            includeHiddenNodes: false
          }}
          minZoom={0.3}
          maxZoom={2}
          selectNodesOnDrag={false}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          className="bg-muted"
        >
          <Background color="hsl(var(--muted-foreground))" gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
        
        {/* Stats Badge Overlay */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-none z-10">
          <Badge variant="secondary" className="bg-card/90 backdrop-blur-sm border shadow-md">
            {Object.keys(exchangeTree.exchanges).length} {Object.keys(exchangeTree.exchanges).length === 1 ? 'exchange' : 'exchanges'} • 
            {conversationUtils.getLeafNodes(exchangeTree).length} {conversationUtils.getLeafNodes(exchangeTree).length === 1 ? 'branch' : 'branches'}
          </Badge>
        </div>
      </div>
    </div>
  );
};

// Main wrapper component with React Flow Provider
const TreeVisualization: React.FC<TreeVisualizationProps> = ({ className = '' }) => {
  return (
    <ReactFlowProvider>
      <TreeVisualizationFlow className={className} />
    </ReactFlowProvider>
  );
};


export default TreeVisualization;
