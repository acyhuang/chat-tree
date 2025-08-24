/**
 * TypeScript interfaces for conversation data structures.
 * 
 * These interfaces match the backend Pydantic models to ensure
 * type safety across the frontend-backend boundary.
 */

export type MessageRole = "user" | "assistant";

export interface ConversationNode {
  id: string;
  content: string;
  summary: string; // Auto-generated from content if not provided
  role: MessageRole;
  parent_id: string | null;
  children_ids: string[];
  metadata: Record<string, any>;
}

// New exchange-based node for tree display
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

export interface ConversationTree {
  id: string;
  nodes: Record<string, ConversationNode>;
  root_id: string | null;
  current_path: string[];
  metadata: Record<string, any>;
}

// New exchange-based conversation tree for tree display
export interface ExchangeTree {
  id: string;
  exchanges: Record<string, ExchangeNode>;
  root_id: string | null;
  current_path: string[]; // path of exchange IDs
  metadata: Record<string, any>;
}

// API Request types
export interface CreateNodeRequest {
  content: string;
  role: MessageRole;
  parent_id?: string | null;
  summary?: string | null;
}

export interface CreateConversationRequest {
  initial_message?: string | null;
}

// API Response types
export interface ConversationResponse {
  conversation: ConversationTree;
}

export interface NodeResponse {
  node: ConversationNode;
}

export interface PathResponse {
  path: string[];
  nodes: ConversationNode[];
}

export interface ChatRequest {
  message: string;
  conversation_id: string;
  parent_id?: string | null;
  system_prompt?: string | null;
}

export interface ChatResponse {
  user_node: ConversationNode;
  assistant_node: ConversationNode;
  updated_conversation: ConversationTree;
}

// Frontend-specific types
export interface ConversationState {
  currentConversation: ConversationTree | null;
  currentExchangeTree: ExchangeTree | null; // Tree representation for UI
  isLoading: boolean;
  error: string | null;
}

export interface ApiError {
  message: string;
  status?: number;
  detail?: string;
}
