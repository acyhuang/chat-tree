/**
 * API client for communicating with the chat-tree backend.
 * 
 * Provides type-safe methods for all backend endpoints with proper
 * error handling and response parsing.
 */

import {
  ExchangeTree,
  ExchangeNode,
  CreateExchangeRequest,
  CreateConversationRequest,
  ExchangeTreeResponse,
  ExchangeResponse,
  PathResponse,
  ChatRequest,
  ChatResponse,
  ApiError,
  // Legacy types for backward compatibility
  ConversationTree,
  ConversationNode,
  CreateNodeRequest,
  ConversationResponse,
  NodeResponse
} from '../types/conversation';
import { logger } from '../utils/logger';

const API_BASE_URL = 'http://localhost:8000';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Make an HTTP request with proper error handling.
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let errorDetail = '';

        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorDetail = typeof errorData.detail === 'string' 
              ? errorData.detail 
              : JSON.stringify(errorData.detail);
          }
        } catch {
          // Ignore JSON parsing errors for error responses
        }

        const apiError: ApiError = {
          message: errorMessage,
          status: response.status,
          detail: errorDetail
        };

        throw apiError;
      }

      // Handle no-content responses
      if (response.status === 204) {
        return null as unknown as T;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        // Network error
        const networkError: ApiError = {
          message: 'Network error - is the backend server running?',
          detail: error.message
        };
        throw networkError;
      }
      
      // Re-throw ApiError as-is, wrap other errors
      if ((error as ApiError).message) {
        throw error;
      }
      
      const wrappedError: ApiError = {
        message: 'Unexpected error occurred',
        detail: error instanceof Error ? error.message : String(error)
      };
      throw wrappedError;
    }
  }

  // Exchange-based Conversation Management

  /**
   * Create a new exchange tree.
   */
  async createConversation(request: CreateConversationRequest): Promise<ExchangeTree> {
    const response = await this.makeRequest<ExchangeTreeResponse>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response.conversation;
  }

  /**
   * Get an exchange tree by ID.
   */
  async getConversation(conversationId: string): Promise<ExchangeTree> {
    const response = await this.makeRequest<ExchangeTreeResponse>(
      `/api/conversations/${conversationId}`
    );
    return response.conversation;
  }

  /**
   * Delete a conversation.
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await this.makeRequest<void>(`/api/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  }

  /**
   * List all conversations (debug endpoint).
   */
  async listConversations(): Promise<string[]> {
    return this.makeRequest<string[]>('/api/conversations');
  }

  // Exchange Operations

  /**
   * Create a new exchange in a conversation.
   */
  async createExchange(conversationId: string, request: CreateExchangeRequest): Promise<ExchangeNode> {
    const response = await this.makeRequest<ExchangeResponse>(`/api/exchanges?conversation_id=${conversationId}`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response.exchange;
  }

  /**
   * Get a single exchange by ID.
   */
  async getExchange(conversationId: string, exchangeId: string): Promise<ExchangeNode> {
    const response = await this.makeRequest<ExchangeResponse>(
      `/api/exchanges/${exchangeId}?conversation_id=${conversationId}`
    );
    return response.exchange;
  }

  /**
   * Delete an exchange and all its children.
   */
  async deleteExchange(conversationId: string, exchangeId: string): Promise<void> {
    await this.makeRequest<void>(`/api/exchanges/${exchangeId}?conversation_id=${conversationId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get the path from root to a specific exchange.
   */
  async getPathToExchange(conversationId: string, exchangeId: string): Promise<PathResponse> {
    return this.makeRequest<PathResponse>(
      `/api/exchange-paths/${exchangeId}?conversation_id=${conversationId}`
    );
  }

  // Legacy Node Operations (for backward compatibility)

  /**
   * DEPRECATED: Create a new node in a conversation.
   */
  async createNode(conversationId: string, request: CreateNodeRequest): Promise<ConversationNode> {
    const response = await this.makeRequest<NodeResponse>(`/api/legacy/nodes?conversation_id=${conversationId}`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response.node;
  }

  /**
   * DEPRECATED: Get a single node by ID.
   */
  async getNode(conversationId: string, nodeId: string): Promise<ConversationNode> {
    const response = await this.makeRequest<NodeResponse>(
      `/api/legacy/nodes/${nodeId}?conversation_id=${conversationId}`
    );
    return response.node;
  }

  /**
   * DEPRECATED: Delete a node and all its children.
   */
  async deleteNode(conversationId: string, nodeId: string): Promise<void> {
    await this.makeRequest<void>(`/api/legacy/nodes/${nodeId}?conversation_id=${conversationId}`, {
      method: 'DELETE',
    });
  }

  /**
   * DEPRECATED: Get the path from root to a specific node.
   */
  async getPathToNode(conversationId: string, nodeId: string): Promise<PathResponse> {
    return this.makeRequest<PathResponse>(
      `/api/legacy/paths/${nodeId}?conversation_id=${conversationId}`
    );
  }

  // LLM Interaction

  /**
   * Send a chat message and get an LLM response.
   */
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    return this.makeRequest<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Stream a chat message and get real-time LLM response chunks.
   */
  async streamChatMessage(
    request: ChatRequest,
    abortController: AbortController,
    onChunk: (content: string) => void,
    onExchangeCreated?: (exchangeId: string, conversationId: string) => void,
    onComplete?: (exchange: any) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body for streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }

          // Accumulate chunks in buffer to handle partial lines
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          
          // Keep the last (potentially incomplete) line in buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6); // Remove 'data: ' prefix
              if (data.trim() === '') continue;

              try {
                const parsed = JSON.parse(data);
                logger.debug('Parsed streaming message:', parsed.type);
                
                switch (parsed.type) {
                  case 'exchange_created':
                    logger.info('Exchange created:', parsed.exchange_id);
                    onExchangeCreated?.(parsed.exchange_id, parsed.conversation_id);
                    break;
                  case 'content':
                    // Content chunks not logged individually for performance
                    onChunk(parsed.data);
                    break;
                  case 'done':
                    // Completion logged by store, not here
                    // Backend now sends final_content directly, not in exchange object
                    onComplete?.(parsed);
                    return; // Exit successfully
                  case 'error':
                    logger.error('Streaming error:', parsed.message);
                    onError?.(parsed.message);
                    return; // Exit with error
                  default:
                    logger.warn('Unknown streaming message type:', parsed.type);
                }
              } catch (parseError) {
                logger.warn('Failed to parse streaming data:', data, parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      // Check if this was an abort
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown streaming error';
      onError?.(errorMessage);
      throw error;
    }
  }

  /**
   * DEPRECATED: Send a chat message and get an LLM response.
   */
  async sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
    return this.sendMessage(request);
  }

  // Utility Methods

  /**
   * Save an interrupted exchange to the backend.
   */
  async saveInterruptedExchange(conversationId: string, exchange: ExchangeNode): Promise<void> {
    await this.makeRequest<{ status: string; exchange_id: string }>(
      `/api/exchanges/save-interrupted?conversation_id=${conversationId}`,
      {
        method: 'POST',
        body: JSON.stringify(exchange),
      }
    );
  }

  /**
   * Check if the backend is healthy.
   */
  async healthCheck(): Promise<{ status: string; storage_stats: Record<string, number> }> {
    return this.makeRequest<{ status: string; storage_stats: Record<string, number> }>('/health');
  }

  /**
   * Get basic info about the API.
   */
  async getApiInfo(): Promise<{ message: string; version: string }> {
    return this.makeRequest<{ message: string; version: string }>('/');
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for testing or custom instances
export { ApiClient };
