/**
 * Utilities for transforming ExchangeTree data into React Flow nodes and edges format
 */
import { Node, Edge } from '@xyflow/react';
import { ExchangeTree, ExchangeNode } from '../types/conversation';
import { logger } from './logger';
import { conversationUtils } from '../store/conversationStore';

/**
 * Helper function to get CSS variable value from the document root
 */
export function getCSSVariable(variable: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();
}

/**
 * Get resolved CSS custom property values for styling React Flow elements
 */
export function getThemeColors() {
  return {
    border: getCSSVariable('--border') || 'hsl(214.3 31.8% 91.4%)',
    mutedForeground: getCSSVariable('--muted-foreground') || 'hsl(215.4 16.3% 46.9%)',
    background: getCSSVariable('--background') || 'hsl(0 0% 100%)',
    card: getCSSVariable('--card') || 'hsl(0 0% 100%)',
    primary: getCSSVariable('--primary') || 'hsl(222.2 84% 4.9%)',
    secondary: getCSSVariable('--secondary') || 'hsl(210 40% 96%)'
  };
}

export interface FlowExchangeNode extends Node {
  data: {
    exchange: ExchangeNode;
    isInCurrentPath: boolean;
    isSelected: boolean;
    isLeaf: boolean;
    canBranch: boolean;
    level: number;
  };
}

export interface TreeLayout {
  nodes: FlowExchangeNode[];
  edges: Edge[];
}

/**
 * Transform ExchangeTree into React Flow nodes and edges with hierarchical layout
 */
export function transformExchangeTreeToFlow(
  exchangeTree: ExchangeTree
): TreeLayout {
  if (!exchangeTree.root_id) {
    logger.debug('No root_id found in exchange tree');
    return { nodes: [], edges: [] };
  }

  const nodes: FlowExchangeNode[] = [];
  const edges: Edge[] = [];
  const positions = new Map<string, { x: number; y: number; level: number }>();

  // Removed verbose logging

  // First pass: Calculate positions for all nodes
  calculateNodePositions(exchangeTree, exchangeTree.root_id, 0, 0, positions);

  // Second pass: Create nodes and edges
  createNodesAndEdges(exchangeTree, exchangeTree.root_id, 0, positions, nodes, edges);

  logger.debug(`Tree transformed - ${nodes.length} nodes, ${edges.length} edges`);

  return { nodes, edges };
}

/**
 * Calculate positions for all nodes in the tree
 */
function calculateNodePositions(
  exchangeTree: ExchangeTree,
  nodeId: string,
  level: number,
  parentX: number,
  positions: Map<string, { x: number; y: number; level: number }>
) {
  const children = conversationUtils.getNodeChildren(exchangeTree, nodeId);
  const nodeCount = children.length;

  // Position current node
  positions.set(nodeId, {
    x: parentX,
    y: level * 160, // Increased vertical spacing for React Flow
    level
  });

  // Position children
  if (nodeCount > 0) {
    const spacing = 200; // Increased horizontal spacing for React Flow
    const totalWidth = (nodeCount - 1) * spacing;
    const startX = parentX - totalWidth / 2;

    children.forEach((child, index) => {
      const childX = startX + index * spacing;
      calculateNodePositions(exchangeTree, child.id, level + 1, childX, positions);
    });
  }
}

/**
 * Create React Flow nodes and edges from calculated positions
 */
function createNodesAndEdges(
  exchangeTree: ExchangeTree,
  nodeId: string,
  level: number,
  positions: Map<string, { x: number; y: number; level: number }>,
  nodes: FlowExchangeNode[],
  edges: Edge[]
) {
  const exchange = exchangeTree.exchanges[nodeId];
  if (!exchange) return;

  const position = positions.get(nodeId);
  if (!position) return;

  const children = conversationUtils.getNodeChildren(exchangeTree, nodeId);
  const isInCurrentPath = conversationUtils.isNodeInCurrentPath(exchangeTree, nodeId);
  const isSelected = exchangeTree.current_path.length > 0 && 
    exchangeTree.current_path[exchangeTree.current_path.length - 1] === nodeId;
  const isLeaf = children.length === 0;
  const canBranch = conversationUtils.canBranchFromExchange(exchange) && isInCurrentPath;

  // Create node
  const flowNode: FlowExchangeNode = {
    id: nodeId,
    type: 'exchangeNode',
    position: { x: position.x, y: position.y },
    data: {
      exchange,
      isInCurrentPath,
      isSelected,
      isLeaf,
      canBranch,
      level
    },
    draggable: false,
    selectable: true
  };

  nodes.push(flowNode);

  // Create edges and process children
  children.forEach((child) => {
    const colors = getThemeColors();
    
    // Create edge from current node to child
    const edge: Edge = {
      id: `${nodeId}-${child.id}`,
      source: nodeId,
      target: child.id,
      type: 'smoothstep',
      animated: false,
      style: {
        stroke: isInCurrentPath ? colors.mutedForeground : colors.border
      }
    };

    // Removed verbose logging

    edges.push(edge);

    // Recursively process children
    createNodesAndEdges(exchangeTree, child.id, level + 1, positions, nodes, edges);
  });
}

/**
 * Update node styles based on current path (for dynamic updates)
 */
export function updateNodeStyles(
  nodes: FlowExchangeNode[],
  edges: Edge[],
  exchangeTree: ExchangeTree
): { nodes: FlowExchangeNode[]; edges: Edge[] } {
  const updatedNodes = nodes.map(node => {
    const isInCurrentPath = conversationUtils.isNodeInCurrentPath(exchangeTree, node.id);
    const isSelected = exchangeTree.current_path.length > 0 && 
      exchangeTree.current_path[exchangeTree.current_path.length - 1] === node.id;
    const canBranch = conversationUtils.canBranchFromExchange(node.data.exchange) && isInCurrentPath;

    return {
      ...node,
      data: {
        ...node.data,
        isInCurrentPath,
        isSelected,
        canBranch
      }
    };
  });

  const updatedEdges = edges.map(edge => {
    // Check if this edge represents a connection in the current path
    // An edge should be highlighted only if it connects consecutive nodes in the current path
    const currentPath = exchangeTree.current_path;
    const isEdgeInActivePath = currentPath.length > 0 && 
      currentPath.some((nodeId, index) => {
        // Check if this edge connects the current node to the next node in the path
        if (index < currentPath.length - 1) {
          const nextNodeId = currentPath[index + 1];
          return edge.source === nodeId && edge.target === nextNodeId;
        }
        // Also check if this edge connects root to first path node
        if (index === 0 && exchangeTree.root_id) {
          return edge.source === exchangeTree.root_id && edge.target === nodeId;
        }
        return false;
      });
    
    const colors = getThemeColors();

    return {
      ...edge,
      style: {
        ...edge.style,
        stroke: isEdgeInActivePath ? colors.mutedForeground : colors.border,
        strokeWidth: isEdgeInActivePath ? 2 : 1,
        opacity: isEdgeInActivePath ? 1 : 0.5
      }
    };
  });

  return { nodes: updatedNodes, edges: updatedEdges };
}