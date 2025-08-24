/**
 * Zustand store for exchange-based conversation state management.
 * 
 * Manages conversation data, loading states, and provides actions
 * for interacting with the backend API.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { 
  ExchangeTree,
  ExchangeNode,
  CreateConversationRequest,
  ChatRequest,
  ChatResponse,
  ApiError,
  ConversationState
} from '../types/conversation';
import { apiClient } from '../api/client';

interface ExchangeConversationState extends ConversationState {
  // Actions
  createConversation: (request: CreateConversationRequest) => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  setCurrentPath: (exchangeId: string) => Promise<void>;
  sendMessage: (message: string, systemPrompt?: string) => Promise<ChatResponse>;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  currentExchangeTree: null,
  isLoading: false,
  error: null,
};

export const useConversationStore = create<ExchangeConversationState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      createConversation: async (request: CreateConversationRequest) => {
        set({ isLoading: true, error: null });
        
        try {
          const conversation = await apiClient.createConversation(request);
          set({ 
            currentExchangeTree: conversation,
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
          set({ 
            currentExchangeTree: conversation,
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

      setCurrentPath: async (exchangeId: string) => {
        const { currentExchangeTree } = get();
        if (!currentExchangeTree) {
          throw new Error('No conversation loaded');
        }

        try {
          const path = await apiClient.getPathToExchange(currentExchangeTree.id, exchangeId);
          
          // Update the current exchange tree with new path
          const updatedTree = {
            ...currentExchangeTree,
            current_path: path.path
          };
          
          set({ currentExchangeTree: updatedTree });
        } catch (error) {
          const apiError = error as ApiError;
          set({ error: apiError.detail || apiError.message });
          throw error;
        }
      },

      sendMessage: async (message: string, systemPrompt?: string) => {
        const { currentExchangeTree } = get();
        if (!currentExchangeTree) {
          throw new Error('No conversation loaded');
        }

        set({ isLoading: true, error: null });
        
        try {
          const chatRequest: ChatRequest = {
            message,
            conversation_id: currentExchangeTree.id,
            parent_id: currentExchangeTree.current_path.length > 0 
              ? currentExchangeTree.current_path[currentExchangeTree.current_path.length - 1]
              : null,
            system_prompt: systemPrompt
          };

          const response = await apiClient.sendMessage(chatRequest);
          
          set({ 
            currentExchangeTree: response.updated_conversation,
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
      }
    }),
    {
      name: 'conversation-storage',
    }
  )
);

// Utility functions for working with exchange trees
export const conversationUtils = {
  /**
   * Get children of an exchange.
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
    let currentId: string | null = exchangeId;
    
    while (currentId && exchangeTree.exchanges[currentId]) {
      const exchange = exchangeTree.exchanges[currentId];
      if (exchange.parent_id) {
        depth++;
        currentId = exchange.parent_id;
      } else {
        break;
      }
    }
    
    return depth;
  },

  /**
   * Get all leaf nodes in the tree.
   */
  getLeafNodes: (exchangeTree: ExchangeTree | null): ExchangeNode[] => {
    if (!exchangeTree) return [];
    
    return Object.values(exchangeTree.exchanges).filter(
      exchange => exchange.children_ids.length === 0
    );
  },

  /**
   * Check if an exchange can be branched from (is complete).
   */
  canBranchFromExchange: (exchange: ExchangeNode): boolean => {
    return exchange.is_complete && !exchange.assistant_loading;
  },

  /**
   * Get the path from root to a specific exchange.
   */
  getPathToExchange: (exchangeTree: ExchangeTree | null, exchangeId: string): string[] => {
    if (!exchangeTree || !exchangeTree.exchanges[exchangeId]) return [];
    
    const path: string[] = [];
    let currentId: string | null = exchangeId;
    
    while (currentId && exchangeTree.exchanges[currentId]) {
      path.unshift(currentId);
      const exchange = exchangeTree.exchanges[currentId];
      currentId = exchange.parent_id;
    }
    
    return path;
  }
};

// Hook to get current exchange tree
export const useCurrentExchangeTree = () => {
  return useConversationStore(state => state.currentExchangeTree);
};

// Hook to check loading state
export const useIsLoading = () => {
  return useConversationStore(state => state.isLoading);
};

// Hook to get error state
export const useError = () => {
  return useConversationStore(state => state.error);
};