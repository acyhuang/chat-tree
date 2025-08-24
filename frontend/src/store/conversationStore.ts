/**
 * Zustand store for conversation state management.
 * 
 * Manages conversation data, loading states, and provides actions
 * for interacting with the backend API.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { 
  ConversationTree, 
  ConversationNode, 
  ExchangeTree,
  ExchangeNode,
  CreateNodeRequest, 
  CreateConversationRequest,
  ChatRequest,
  ChatResponse,
  ApiError 
} from '../types/conversation';
import { apiClient } from '../api/client';

interface ConversationState {
  // State
  currentConversation: ConversationTree | null;
  currentExchangeTree: ExchangeTree | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createConversation: (request: CreateConversationRequest) => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  addNode: (request: CreateNodeRequest) => Promise<ConversationNode | null>;
  deleteNode: (nodeId: string) => Promise<void>;
  setCurrentPath: (nodeId: string) => Promise<void>;
  sendMessage: (message: string, systemPrompt?: string) => Promise<ChatResponse>;
  clearError: () => void;
  reset: () => void;
}

// Utility functions to convert between message-based and exchange-based structures
const conversationToExchangeTree = (conversation: ConversationTree): ExchangeTree => {
  if (!conversation.root_id) {
    return {
      id: conversation.id,
      exchanges: {},
      root_id: null,
      current_path: [],
      metadata: conversation.metadata
    };
  }

  const exchanges: Record<string, ExchangeNode> = {};
  const processedNodes = new Set<string>();
  const exchangeIdMap = new Map<string, string>(); // node ID -> exchange ID
  
  // Process nodes in pairs starting from root
  const processNodePair = (userNodeId: string, parentExchangeId: string | null): string => {
    const userNode = conversation.nodes[userNodeId];
    if (!userNode || userNode.role !== 'user') {
      throw new Error(`Expected user node, got ${userNode?.role || 'undefined'}`);
    }

    // Find assistant response
    const assistantNodeId = userNode.children_ids.find(childId => 
      conversation.nodes[childId]?.role === 'assistant'
    );
    
    const assistantNode = assistantNodeId ? conversation.nodes[assistantNodeId] : null;
    
    // Create exchange ID (use user node ID as base)
    const exchangeId = `exchange_${userNode.id}`;
    exchangeIdMap.set(userNodeId, exchangeId);
    if (assistantNode) {
      exchangeIdMap.set(assistantNode.id, exchangeId);
    }

    // Create exchange node
    const exchange: ExchangeNode = {
      id: exchangeId,
      user_content: userNode.content,
      user_summary: userNode.summary,
      assistant_content: assistantNode?.content || null,
      assistant_summary: assistantNode?.summary || null,
      assistant_loading: !assistantNode,
      is_complete: !!assistantNode,
      parent_id: parentExchangeId,
      children_ids: [], // Will be populated when processing children
      metadata: {
        ...userNode.metadata,
        user_node_id: userNode.id,
        assistant_node_id: assistantNode?.id || null
      }
    };

    exchanges[exchangeId] = exchange;
    processedNodes.add(userNodeId);
    if (assistantNode) {
      processedNodes.add(assistantNode.id);
    }

    // Process children (next user messages)
    const nextUserNodes = (assistantNode?.children_ids || [])
      .map(childId => conversation.nodes[childId])
      .filter(node => node && node.role === 'user');

    exchange.children_ids = nextUserNodes.map(userNode => {
      const childExchangeId = processNodePair(userNode.id, exchangeId);
      return childExchangeId;
    });

    return exchangeId;
  };

  // Start processing from root
  const rootExchangeId = processNodePair(conversation.root_id, null);

  // Convert current path to exchange path
  const exchangePath: string[] = [];
  for (const nodeId of conversation.current_path) {
    const exchangeId = exchangeIdMap.get(nodeId);
    if (exchangeId && !exchangePath.includes(exchangeId)) {
      exchangePath.push(exchangeId);
    }
  }

  return {
    id: conversation.id,
    exchanges,
    root_id: rootExchangeId,
    current_path: exchangePath,
    metadata: conversation.metadata
  };
};

const initialState = {
  currentConversation: null,
  currentExchangeTree: null,
  isLoading: false,
  error: null,
};

export const useConversationStore = create<ConversationState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      createConversation: async (request: CreateConversationRequest) => {
        set({ isLoading: true, error: null });
        
        try {
          const conversation = await apiClient.createConversation(request);
          const exchangeTree = conversationToExchangeTree(conversation);
          set({ 
            currentConversation: conversation, 
            currentExchangeTree: exchangeTree,
            isLoading: false 
          });
        } catch (error) {
          const apiError = error as ApiError;
          set({ 
            error: apiError.detail || apiError.message, 
            isLoading: false 
          });
          throw error;
        }
      },

      loadConversation: async (conversationId: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const conversation = await apiClient.getConversation(conversationId);
          const exchangeTree = conversationToExchangeTree(conversation);
          set({ 
            currentConversation: conversation, 
            currentExchangeTree: exchangeTree,
            isLoading: false 
          });
        } catch (error) {
          const apiError = error as ApiError;
          set({ 
            error: apiError.detail || apiError.message, 
            isLoading: false 
          });
          throw error;
        }
      },

      addNode: async (request: CreateNodeRequest): Promise<ConversationNode | null> => {
        const { currentConversation } = get();
        if (!currentConversation) {
          throw new Error('No conversation loaded');
        }

        set({ isLoading: true, error: null });
        
        try {
          const newNode = await apiClient.createNode(currentConversation.id, request);
          
          // Refresh the conversation to get the updated tree
          await get().loadConversation(currentConversation.id);
          
          return newNode;
        } catch (error) {
          const apiError = error as ApiError;
          set({ 
            error: apiError.detail || apiError.message, 
            isLoading: false 
          });
          throw error;
        }
      },

      deleteNode: async (nodeId: string) => {
        const { currentConversation } = get();
        if (!currentConversation) {
          throw new Error('No conversation loaded');
        }

        set({ isLoading: true, error: null });
        
        try {
          await apiClient.deleteNode(currentConversation.id, nodeId);
          
          // Refresh the conversation to get the updated tree
          await get().loadConversation(currentConversation.id);
        } catch (error) {
          const apiError = error as ApiError;
          set({ 
            error: apiError.detail || apiError.message, 
            isLoading: false 
          });
          throw error;
        }
      },

      setCurrentPath: async (nodeId: string) => {
        const { currentConversation } = get();
        if (!currentConversation) {
          throw new Error('No conversation loaded');
        }

        set({ isLoading: true, error: null });
        
        try {
          const pathResponse = await apiClient.getPathToNode(currentConversation.id, nodeId);
          
          // Update the current path in the conversation
          const updatedConversation = {
            ...currentConversation,
            current_path: pathResponse.path
          };
          
          const exchangeTree = conversationToExchangeTree(updatedConversation);
          set({ 
            currentConversation: updatedConversation, 
            currentExchangeTree: exchangeTree,
            isLoading: false 
          });
        } catch (error) {
          const apiError = error as ApiError;
          set({ 
            error: apiError.detail || apiError.message, 
            isLoading: false 
          });
          throw error;
        }
      },

      sendMessage: async (message: string, systemPrompt?: string): Promise<ChatResponse> => {
        const { currentConversation } = get();
        if (!currentConversation) {
          throw new Error('No conversation loaded');
        }

        set({ isLoading: true, error: null });
        
        try {
          const chatRequest: ChatRequest = {
            message,
            conversation_id: currentConversation.id,
            system_prompt: systemPrompt || null,
          };

          const response = await apiClient.sendChatMessage(chatRequest);
          
          // Update the store with the updated conversation
          const exchangeTree = conversationToExchangeTree(response.updated_conversation);
          set({ 
            currentConversation: response.updated_conversation, 
            currentExchangeTree: exchangeTree,
            isLoading: false 
          });
          
          return response;
        } catch (error) {
          const apiError = error as ApiError;
          set({ 
            error: apiError.detail || apiError.message, 
            isLoading: false 
          });
          throw error;
        }
      },

      clearError: () => {
        set({ error: null });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'conversation-store', // Name for devtools
    }
  )
);

// Selector hooks for specific pieces of state
export const useCurrentConversation = () => useConversationStore(state => state.currentConversation);
export const useCurrentExchangeTree = () => useConversationStore(state => state.currentExchangeTree);
export const useConversationLoading = () => useConversationStore(state => state.isLoading);
export const useConversationError = () => useConversationStore(state => state.error);

// Utility functions for working with conversation data
export const conversationUtils = {
  /**
   * Get nodes in the current conversation path (for ChatInterface).
   */
  getCurrentPathNodes: (conversation: ConversationTree | null): ConversationNode[] => {
    if (!conversation) return [];
    
    return conversation.current_path
      .map(nodeId => conversation.nodes[nodeId])
      .filter(Boolean);
  },

  /**
   * Get exchanges in the current path.
   */
  getCurrentPathExchanges: (exchangeTree: ExchangeTree | null): ExchangeNode[] => {
    if (!exchangeTree) return [];
    
    return exchangeTree.current_path
      .map(exchangeId => exchangeTree.exchanges[exchangeId])
      .filter(Boolean);
  },

  /**
   * Get all leaf exchanges (exchanges with no children).
   */
  getLeafNodes: (exchangeTree: ExchangeTree | null): ExchangeNode[] => {
    if (!exchangeTree) return [];
    
    return Object.values(exchangeTree.exchanges)
      .filter(exchange => exchange.children_ids.length === 0);
  },

  /**
   * Get children of a specific exchange.
   */
  getNodeChildren: (exchangeTree: ExchangeTree | null, exchangeId: string): ExchangeNode[] => {
    if (!exchangeTree || !exchangeTree.exchanges[exchangeId]) return [];
    
    const exchange = exchangeTree.exchanges[exchangeId];
    return exchange.children_ids
      .map(childId => exchangeTree.exchanges[childId])
      .filter(Boolean);
  },

  /**
   * Check if an exchange is in the current path.
   */
  isNodeInCurrentPath: (exchangeTree: ExchangeTree | null, exchangeId: string): boolean => {
    if (!exchangeTree) return false;
    return exchangeTree.current_path.includes(exchangeId);
  },

  /**
   * Get the depth of an exchange in the tree.
   */
  getNodeDepth: (exchangeTree: ExchangeTree | null, exchangeId: string): number => {
    if (!exchangeTree || !exchangeTree.exchanges[exchangeId]) return 0;
    
    let depth = 0;
    let currentId = exchangeId;
    
    while (currentId && exchangeTree.exchanges[currentId]?.parent_id) {
      depth++;
      currentId = exchangeTree.exchanges[currentId].parent_id!;
    }
    
    return depth;
  },

  /**
   * Check if branching is allowed from this exchange (must be complete).
   */
  canBranchFromExchange: (exchange: ExchangeNode): boolean => {
    return exchange.is_complete;
  }
};
