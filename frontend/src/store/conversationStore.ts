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
import { logger } from '../utils/logger';

interface ExchangeConversationState extends ConversationState {
  // Actions
  createConversation: (request: CreateConversationRequest) => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  setCurrentPath: (exchangeId: string) => Promise<void>;
  sendMessage: (message: string, systemPrompt?: string) => Promise<ChatResponse | void>;
  streamMessage: (chatRequest: ChatRequest) => Promise<void>;
  stopGeneration: () => void;
  saveInterruptedExchange: (exchange: ExchangeNode) => Promise<void>;
  saveCompletedExchange: (exchange: ExchangeNode) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  currentExchangeTree: null,
  isLoading: false,
  error: null,
};

// Global abort controller for stream cancellation
let currentAbortController: AbortController | null = null;
// Track the currently streaming exchange for proper cleanup on interruption
let currentStreamingExchangeId: string | null = null;

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

          // Use streaming for all messages
          logger.info('🚀 Starting streaming chat session');
          await get().streamMessage(chatRequest);
          // Only log success if we reach this point without being aborted
          if (currentAbortController && !currentAbortController.signal.aborted) {
            logger.info('✅ Streaming completed successfully');
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

        // isLoading is already set to true by sendMessage, no need to duplicate

        // Create new abort controller for this request
        currentAbortController = new AbortController();
        const abortController = currentAbortController;

        let realExchangeId: string | null = null;
        
        try {
          // Start streaming - the backend will create the exchange with assistant_loading: true
          await apiClient.streamChatMessage(
            chatRequest,
            abortController,
            // onChunk: update assistant content incrementally
            (content: string) => {
              // Removed verbose chunk logging
              
              const currentState = get();
              if (currentState.currentExchangeTree && realExchangeId) {
                const exchange = currentState.currentExchangeTree.exchanges[realExchangeId];
                if (exchange) {
                  // Update the assistant content incrementally
                  const updatedExchange = {
                    ...exchange,
                    assistant_content: (exchange.assistant_content || '') + content
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
            // onExchangeCreated: create exchange locally instead of fetching from backend
            (exchangeId: string, _conversationId: string) => {
              realExchangeId = exchangeId;
              currentStreamingExchangeId = exchangeId;
              logger.debug('Exchange created locally:', exchangeId);
              
              // Create exchange locally instead of fetching from backend
              const currentState = get();
              if (currentState.currentExchangeTree) {
                const newExchange: ExchangeNode = {
                  id: exchangeId,
                  user_content: chatRequest.message,
                  user_summary: '',
                  assistant_content: '',
                  assistant_summary: '',
                  assistant_loading: true,
                  is_complete: false,
                  parent_id: chatRequest.parent_id || null,
                  children_ids: [],
                  metadata: {
                    timestamp: new Date().toISOString()
                  }
                };

                // Add to local state and update parent relationships
                const updatedExchanges = {
                  ...currentState.currentExchangeTree.exchanges,
                  [exchangeId]: newExchange
                };
                
                // Update parent's children if needed
                if (newExchange.parent_id && updatedExchanges[newExchange.parent_id]) {
                  const parent = updatedExchanges[newExchange.parent_id];
                  if (!parent.children_ids.includes(exchangeId)) {
                    updatedExchanges[newExchange.parent_id] = {
                      ...parent,
                      children_ids: [...parent.children_ids, exchangeId]
                    };
                  }
                }

                // Handle root_id assignment (port from backend logic)
                // If this is the first exchange (no parent_id) and no root_id exists, set as root
                const shouldSetAsRoot = !newExchange.parent_id && !currentState.currentExchangeTree.root_id;
                const newRootId = shouldSetAsRoot ? exchangeId : currentState.currentExchangeTree.root_id;

                // Calculate new path to the exchange
                const tempTree = { 
                  ...currentState.currentExchangeTree, 
                  exchanges: updatedExchanges,
                  root_id: newRootId
                };
                const newPath = conversationUtils.getPathToExchange(tempTree, exchangeId);

                set({
                  currentExchangeTree: {
                    ...currentState.currentExchangeTree,
                    exchanges: updatedExchanges,
                    root_id: newRootId,
                    current_path: newPath
                  }
                  // Keep isLoading: true during streaming
                });
              }
            },
            // onComplete: mark as complete, ensure final content is set, and save to backend
            (exchange: any) => {
              const currentState = get();
              if (currentState.currentExchangeTree && realExchangeId) {
                const currentExchange = currentState.currentExchangeTree.exchanges[realExchangeId];
                if (currentExchange) {
                  const updatedExchange = {
                    ...currentExchange,
                    assistant_content: exchange.assistant_content || exchange.final_content || currentExchange.assistant_content,
                    assistant_loading: false,
                    is_complete: true
                  };
                  
                  // Update local state immediately
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

                  // Save completed exchange to backend (fire-and-forget)
                  get().saveCompletedExchange(updatedExchange);
                }
              }
              // Clear streaming exchange tracking
              currentStreamingExchangeId = null;
            },
            // onError: handle streaming errors
            (error: string) => {
              set({ 
                error: error,
                isLoading: false 
              });
              // Clear streaming exchange tracking on error
              currentStreamingExchangeId = null;
            }
          );
        } catch (error) {
          // Check if this was an abort
          if (abortController.signal.aborted) {
            set({ isLoading: false });
            // Clear streaming exchange tracking on abort
            currentStreamingExchangeId = null;
            return;
          }
          
          const apiError = error as ApiError;
          set({ 
            error: apiError.detail || apiError.message, 
            isLoading: false 
          });
          throw error;
        } finally {
          // Clear the abort controller
          if (currentAbortController === abortController) {
            currentAbortController = null;
          }
          // Clear streaming exchange tracking in finally block
          if (currentStreamingExchangeId && abortController.signal.aborted) {
            currentStreamingExchangeId = null;
          }
        }
      },

      stopGeneration: () => {
        if (currentAbortController && !currentAbortController.signal.aborted) {
          logger.info('Stopping message generation');
          currentAbortController.abort();
          
          // Mark the currently streaming exchange as complete and save to backend
          if (currentStreamingExchangeId) {
            const currentState = get();
            if (currentState.currentExchangeTree) {
              const streamingExchange = currentState.currentExchangeTree.exchanges[currentStreamingExchangeId];
              if (streamingExchange) {
                const updatedExchange = {
                  ...streamingExchange,
                  assistant_loading: false,
                  is_complete: true
                };
                
                // Update local state immediately
                set({ 
                  currentExchangeTree: { 
                    ...currentState.currentExchangeTree,
                    exchanges: {
                      ...currentState.currentExchangeTree.exchanges,
                      [currentStreamingExchangeId]: updatedExchange
                    }
                  },
                  isLoading: false 
                });

                // Save interrupted exchange to backend (fire-and-forget)
                get().saveInterruptedExchange(updatedExchange);
              }
            }
            // Clear streaming exchange tracking
            currentStreamingExchangeId = null;
          } else {
            set({ isLoading: false });
          }
        }
      },

      saveInterruptedExchange: async (exchange: ExchangeNode) => {
        const { currentExchangeTree } = get();
        if (!currentExchangeTree) {
          logger.warn('Cannot save interrupted exchange: no conversation loaded');
          return;
        }

        try {
          await apiClient.saveInterruptedExchange(currentExchangeTree.id, exchange);
          logger.info('✅ Interrupted exchange saved to backend:', exchange.id);
        } catch (error) {
          logger.error('❌ Failed to save interrupted exchange:', error);
          // Don't throw - we don't want to disrupt the user experience
          // The exchange is still visible in the frontend
        }
      },

      saveCompletedExchange: async (exchange: ExchangeNode) => {
        const { currentExchangeTree } = get();
        if (!currentExchangeTree) {
          logger.warn('Cannot save completed exchange: no conversation loaded');
          return;
        }

        try {
          await apiClient.saveInterruptedExchange(currentExchangeTree.id, exchange);
          logger.info('✅ Completed exchange saved to backend:', exchange.id);
        } catch (error) {
          logger.error('❌ Failed to save completed exchange:', error);
          // Non-critical error - exchange is already visible to user
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
      const exchange: ExchangeNode = exchangeTree.exchanges[currentId];
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
      const exchange: ExchangeNode = exchangeTree.exchanges[currentId];
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