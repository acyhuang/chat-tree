/**
 * TypeScript interfaces for conversation data structures.
 * 
 * These interfaces match the backend Pydantic models to ensure
 * type safety across the frontend-backend boundary.
 */

export type MessageRole = "user" | "assistant";

// Primary data structures (exchange-based)
export interface ExchangeNode {
  id: string;
  user_content: string;
  user_summary: string;
  assistant_content: string | null;
  assistant_summary: string | null;
  assistant_loading: boolean;
  is_complete: boolean; // true when both user and assistant parts are present
  parent_id: string | null;
  children_ids: string[];
  metadata: Record<string, any>;
}

export interface ExchangeTree {
  id: string;
  exchanges: Record<string, ExchangeNode>;
  root_id: string | null;
  current_path: string[]; // path of exchange IDs
  metadata: Record<string, any>;
}

// Legacy data structures (kept for backward compatibility)
export interface ConversationNode {
  id: string;
  content: string;
  summary: string; // Auto-generated from content if not provided
  role: MessageRole;
  parent_id: string | null;
  children_ids: string[];
  metadata: Record<string, any>;
}

export interface ConversationTree {
  id: string;
  nodes: Record<string, ConversationNode>;
  root_id: string | null;
  current_path: string[];
  metadata: Record<string, any>;
}

// API Request types
export interface CreateExchangeRequest {
  user_content: string;
  parent_id?: string | null;
  user_summary?: string | null;
}

export interface CreateConversationRequest {
  initial_message?: string | null;
}

// API Response types
export interface ExchangeTreeResponse {
  conversation: ExchangeTree;
}

export interface ExchangeResponse {
  exchange: ExchangeNode;
}

export interface PathResponse {
  path: string[];
  exchanges: ExchangeNode[];
}

export interface ChatRequest {
  message: string;
  conversation_id: string;
  parent_id?: string | null;
  system_prompt?: string | null;
}

export interface ChatResponse {
  exchange: ExchangeNode;
  updated_conversation: ExchangeTree;
}

// Frontend-specific types
export interface ConversationState {
  currentExchangeTree: ExchangeTree | null;
  isLoading: boolean;
  error: string | null;
}

// Legacy API types (kept for backward compatibility)
export interface CreateNodeRequest {
  content: string;
  role: MessageRole;
  parent_id?: string | null;
  summary?: string | null;
}

export interface ConversationResponse {
  conversation: ConversationTree;
}

export interface NodeResponse {
  node: ConversationNode;
}

export interface ApiError {
  message: string;
  status?: number;
  detail?: string;
}
