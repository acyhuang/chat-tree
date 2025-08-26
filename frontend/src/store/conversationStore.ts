/**
 * Zustand store for exchange-based conversation state management.
 * 
 * Manages conversation data, loading states, and provides actions
 * for interacting with the backend API.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { flushSync } from 'react-dom';
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
  sendMessage: (message: string, systemPrompt?: string) => Promise<ChatResponse | void>;
  streamMessage: (chatRequest: ChatRequest) => Promise<void>;
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

          // Try streaming first, fallback to regular if it fails
          try {
            console.log('Attempting to use streaming...');
            await get().streamMessage(chatRequest);
            console.log('Streaming completed successfully');
          } catch (streamError) {
            console.warn('Streaming failed, falling back to regular message:', streamError);
            const response = await apiClient.sendMessage(chatRequest);
            set({ 
              currentExchangeTree: response.updated_conversation,
              isLoading: false 
            });
            return response;
          }
        } catch (error) {
          const apiError = error as ApiError;
          set({ 
            error: apiError.detail || apiError.message, 
            isLoading: false 
          });
          throw error;
        }
      },

      streamMessage: async (chatRequest: ChatRequest) => {
        const { currentExchangeTree } = get();
        if (!currentExchangeTree) {
          throw new Error('No conversation loaded');
        }

        // Create optimistic user exchange immediately - no assistant exchange yet
        const tempUserExchangeId = `temp-user-${Date.now()}`;
        
        const optimisticUserExchange: ExchangeNode = {
          id: tempUserExchangeId,
          user_content: chatRequest.message,
          user_summary: "",
          assistant_content: "",
          assistant_summary: "",
          assistant_loading: true, // Mark as loading for assistant response
          is_complete: false, // Will be completed when assistant responds
          parent_id: chatRequest.parent_id,
          children_ids: [],
          metadata: {
            timestamp: new Date().toISOString()
          }
        };

        // Update conversation optimistically with just the user exchange
        const optimisticConversation = {
          ...currentExchangeTree,
          exchanges: {
            ...currentExchangeTree.exchanges,
            [tempUserExchangeId]: optimisticUserExchange
          },
          current_path: [...currentExchangeTree.current_path, tempUserExchangeId]
        };

        // Update parent's children if parent exists
        if (chatRequest.parent_id && optimisticConversation.exchanges[chatRequest.parent_id]) {
          const parent = optimisticConversation.exchanges[chatRequest.parent_id];
          parent.children_ids = [...parent.children_ids, tempUserExchangeId];
        }

        set({ currentExchangeTree: optimisticConversation });

        // Start streaming
        let realExchangeId: string | null = null;
        
        await apiClient.streamChatMessage(
          chatRequest,
          // onChunk: update assistant content
          (content: string) => {
            console.debug(`Received chunk: "${content}" (length: ${content.length})`);
            
            const currentState = get();
            if (currentState.currentExchangeTree && realExchangeId) {
              const exchange = currentState.currentExchangeTree.exchanges[realExchangeId];
              if (exchange) {
                // Update the assistant content incrementally
                const updatedExchange = {
                  ...exchange,
                  assistant_content: exchange.assistant_content + content
                };
                
                set({ 
                  currentExchangeTree: { 
                    ...currentState.currentExchangeTree,
                    exchanges: {
                      ...currentState.currentExchangeTree.exchanges,
                      [realExchangeId]: updatedExchange
                    }
                  } 
                });
              }
            }
          },
          // onExchangeCreated: replace temp with real exchange ID
          (exchangeId: string, conversationId: string) => {
            realExchangeId = exchangeId;
            const currentState = get();
            if (currentState.currentExchangeTree) {
              // Replace the temporary user exchange ID with the real one
              const updatedConversation = { ...currentState.currentExchangeTree };
              const tempUserExchange = updatedConversation.exchanges[tempUserExchangeId];
              
              if (tempUserExchange) {
                // Create new exchange with real ID
                updatedConversation.exchanges[exchangeId] = {
                  ...tempUserExchange,
                  id: exchangeId
                };
                
                // Remove temp exchange
                delete updatedConversation.exchanges[tempUserExchangeId];
                
                // Update current path
                updatedConversation.current_path = updatedConversation.current_path.map(id => 
                  id === tempUserExchangeId ? exchangeId : id
                );
                
                // Update parent's children if parent exists
                if (chatRequest.parent_id && updatedConversation.exchanges[chatRequest.parent_id]) {
                  const parent = updatedConversation.exchanges[chatRequest.parent_id];
                  parent.children_ids = parent.children_ids.map(id => 
                    id === tempUserExchangeId ? exchangeId : id
                  );
                }
                
                set({ currentExchangeTree: updatedConversation });
              }
            }
          },
          // onComplete: mark as complete
          (exchange: any) => {
            const currentState = get();
            if (currentState.currentExchangeTree && realExchangeId) {
              const currentExchange = currentState.currentExchangeTree.exchanges[realExchangeId];
              if (currentExchange) {
                const updatedExchange = {
                  ...currentExchange,
                  assistant_content: exchange.assistant_content,
                  assistant_loading: false,
                  is_complete: true
                };
                
                set({ 
                  currentExchangeTree: { 
                    ...currentState.currentExchangeTree,
                    exchanges: {
                      ...currentState.currentExchangeTree.exchanges,
                      [realExchangeId]: updatedExchange
                    }
                  },
                  isLoading: false 
                });
              }
            }
          },
          // onError: handle streaming errors
          (error: string) => {
            set({ 
              error: error,
              isLoading: false 
            });
          }
        );
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