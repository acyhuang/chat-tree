/**
 * Utilities for transforming ExchangeTree data into React Flow nodes and edges format
 */
import { Node, Edge } from '@xyflow/react';
import { ExchangeTree, ExchangeNode } from '../types/conversation';
import { conversationUtils } from '../store/conversationStore';

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
    return { nodes: [], edges: [] };
  }

  const nodes: FlowExchangeNode[] = [];
  const edges: Edge[] = [];
  const positions = new Map<string, { x: number; y: number; level: number }>();

  // First pass: Calculate positions for all nodes
  calculateNodePositions(exchangeTree, exchangeTree.root_id, 0, 0, positions);

  // Second pass: Create nodes and edges
  createNodesAndEdges(exchangeTree, exchangeTree.root_id, 0, positions, nodes, edges);

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
    // Create edge from current node to child
    const edge: Edge = {
      id: `${nodeId}-${child.id}`,
      source: nodeId,
      target: child.id,
      type: 'smoothstep',
      animated: false,
      style: {
        stroke: isInCurrentPath ? 'hsl(var(--border))' : 'hsl(var(--muted-foreground))',
        strokeWidth: isInCurrentPath ? 2 : 1,
        opacity: isInCurrentPath ? 1 : 0.5
      }
    };

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
    const sourceNode = nodes.find(n => n.id === edge.source);
    const isInPath = sourceNode ? conversationUtils.isNodeInCurrentPath(exchangeTree, edge.source) : false;

    return {
      ...edge,
      style: {
        ...edge.style,
        stroke: isInPath ? 'hsl(var(--border))' : 'hsl(var(--muted-foreground))',
        strokeWidth: isInPath ? 2 : 1,
        opacity: isInPath ? 1 : 0.5
      }
    };
  });

  return { nodes: updatedNodes, edges: updatedEdges };
}