/**
 * TreeVisualization component for displaying conversation trees.
 * 
 * Features:
 * - Vertical layout with root at top
 * - Pan/zoom functionality via React Flow
 * - Node preview on hover
 * - Context switching on node click
 * - Visual indicators for current path and branching
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useReactFlow,
  ReactFlowProvider,
  Node
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ExchangeNode } from '../types/conversation';
import { conversationUtils, useCurrentExchangeTree, useConversationStore } from '../store/conversationStore';
import FlowExchangeNode from './FlowExchangeNode';
import { transformExchangeTreeToFlow, updateNodeStyles, FlowExchangeNode as FlowExchangeNodeType } from '../utils/treeToFlow';

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
  const { setCurrentPath } = useConversationStore();
  const exchangeTree = useCurrentExchangeTree();
  const [previewExchange, setPreviewExchange] = useState<ExchangeNode | null>(null);
  const reactFlowInstance = useReactFlow();

  // Transform exchange tree to React Flow format
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!exchangeTree) {
      console.log('🔍 TreeVisualization: No exchange tree');
      return { nodes: [], edges: [] };
    }
    console.log('🔍 TreeVisualization: Transforming exchange tree to flow format');
    const result = transformExchangeTreeToFlow(exchangeTree);
    console.log('🔍 TreeVisualization: Transformation result:', {
      nodesCount: result.nodes.length,
      edgesCount: result.edges.length
    });
    return result;
  }, [exchangeTree]);

  // Update node styles when current path changes
  const { nodes, edges } = useMemo(() => {
    if (!exchangeTree || initialNodes.length === 0) {
      console.log('🔍 TreeVisualization: Skipping style update - no tree or nodes');
      return { nodes: initialNodes, edges: initialEdges };
    }
    console.log('🔍 TreeVisualization: Updating node/edge styles');
    const result = updateNodeStyles(initialNodes, initialEdges, exchangeTree);
    console.log('🔍 TreeVisualization: Final edges passed to ReactFlow:', {
      edgeCount: result.edges.length,
      edges: result.edges.map(e => ({ 
        id: e.id, 
        source: e.source, 
        target: e.target, 
        type: e.type,
        style: e.style 
      }))
    });
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
      console.error('Failed to set current path:', error);
    }
  }, [exchangeTree, setCurrentPath]);

  // Handle node hover for preview
  const handleNodeMouseEnter = useCallback((_event: React.MouseEvent, node: Node) => {
    const flowNode = node as FlowExchangeNodeType;
    setPreviewExchange(flowNode.data.exchange);
  }, []);

  const handleNodeMouseLeave = useCallback(() => {
    setPreviewExchange(null);
  }, []);

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
      {/* Tree Header */}
      <div className="flex-shrink-0 p-4 border-b border-border bg-card">
        <p className="text-sm text-muted-foreground">
          {Object.keys(exchangeTree.exchanges).length} exchanges • 
          {conversationUtils.getLeafNodes(exchangeTree).length} branches
        </p>
      </div>

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
      </div>

      {/* Exchange Preview Panel */}
      {previewExchange && (
        <div className="flex-shrink-0 border-t border-border bg-card p-4 max-h-40 overflow-y-auto tree-preview-panel">
          <div className="space-y-3">
            {/* User Message */}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-2 h-2 rounded-full mt-2 bg-primary" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-sm font-medium text-foreground">You</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(previewExchange.metadata.timestamp || Date.now()).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {previewExchange.user_content}
                </p>
              </div>
            </div>

            {/* Assistant Response */}
            {previewExchange.is_complete ? (
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-2 h-2 rounded-full mt-2 bg-secondary" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium text-foreground">Assistant</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {previewExchange.assistant_content}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-2 h-2 rounded-full mt-2 bg-secondary animate-pulse" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium text-foreground">Assistant</span>
                  </div>
                  <p className="text-sm text-muted-foreground italic">
                    Thinking...
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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
