/**
 * API client for communicating with the chat-tree backend.
 * 
 * Provides type-safe methods for all backend endpoints with proper
 * error handling and response parsing.
 */

import {
  ConversationTree,
  ConversationNode,
  CreateNodeRequest,
  CreateConversationRequest,
  ConversationResponse,
  NodeResponse,
  PathResponse,
  ChatRequest,
  ChatResponse,
  ApiError
} from '../types/conversation';

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

  // Conversation Management

  /**
   * Create a new conversation tree.
   */
  async createConversation(request: CreateConversationRequest): Promise<ConversationTree> {
    const response = await this.makeRequest<ConversationResponse>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response.conversation;
  }

  /**
   * Get a conversation tree by ID.
   */
  async getConversation(conversationId: string): Promise<ConversationTree> {
    const response = await this.makeRequest<ConversationResponse>(
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

  // Node Operations

  /**
   * Create a new node in a conversation.
   */
  async createNode(conversationId: string, request: CreateNodeRequest): Promise<ConversationNode> {
    const response = await this.makeRequest<NodeResponse>(`/api/nodes?conversation_id=${conversationId}`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response.node;
  }

  /**
   * Get a single node by ID.
   */
  async getNode(conversationId: string, nodeId: string): Promise<ConversationNode> {
    const response = await this.makeRequest<NodeResponse>(
      `/api/nodes/${nodeId}?conversation_id=${conversationId}`
    );
    return response.node;
  }

  /**
   * Delete a node and all its children.
   */
  async deleteNode(conversationId: string, nodeId: string): Promise<void> {
    await this.makeRequest<void>(`/api/nodes/${nodeId}?conversation_id=${conversationId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get the path from root to a specific node.
   */
  async getPathToNode(conversationId: string, nodeId: string): Promise<PathResponse> {
    return this.makeRequest<PathResponse>(
      `/api/paths/${nodeId}?conversation_id=${conversationId}`
    );
  }

  // LLM Interaction

  /**
   * Send a chat message and get an LLM response.
   */
  async sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
    return this.makeRequest<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Utility Methods

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
