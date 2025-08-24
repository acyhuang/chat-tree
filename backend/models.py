"""
Data models for the chat-tree application.

Defines the core data structures for conversation nodes and trees.
"""
from datetime import datetime
from typing import Dict, List, Optional, Literal, Any
from uuid import uuid4
from pydantic import BaseModel, Field


def generate_exchange_id() -> str:
    """Generate a unique exchange ID."""
    return str(uuid4())


def generate_node_id() -> str:
    """Generate a unique node ID (legacy - for backward compatibility)."""
    return str(uuid4())


class ExchangeNode(BaseModel):
    """
    Represents a user-assistant exchange in the conversation tree.
    
    Each exchange contains both a user message and (optionally) an assistant response,
    along with metadata and references to parent/children exchanges.
    """
    id: str = Field(default_factory=generate_exchange_id, description="Unique identifier for the exchange")
    user_content: str = Field(description="The user message text")
    user_summary: str = Field(description="Brief summary of user message for display")
    assistant_content: Optional[str] = Field(default=None, description="The assistant response text")
    assistant_summary: Optional[str] = Field(default=None, description="Brief summary of assistant response")
    assistant_loading: bool = Field(default=False, description="Whether assistant response is being generated")
    is_complete: bool = Field(default=False, description="Whether both user and assistant parts are present")
    parent_id: Optional[str] = Field(default=None, description="Reference to parent exchange (null for root)")
    children_ids: List[str] = Field(default_factory=list, description="Array of child exchange IDs")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    
    def model_post_init(self, __context: Any) -> None:
        """Set default metadata values after model initialization."""
        if "timestamp" not in self.metadata:
            self.metadata["timestamp"] = datetime.now().isoformat()
        
        # Auto-generate user summary if not provided
        if not self.user_summary:
            self.user_summary = (self.user_content[:50] + "...") if len(self.user_content) > 50 else self.user_content
        
        # Auto-generate assistant summary if assistant content exists
        if self.assistant_content and not self.assistant_summary:
            self.assistant_summary = (self.assistant_content[:50] + "...") if len(self.assistant_content) > 50 else self.assistant_content
        
        # Update completion status
        self.is_complete = bool(self.assistant_content and not self.assistant_loading)


class ConversationNode(BaseModel):
    """
    Legacy: Represents a single message node in the conversation tree.
    
    DEPRECATED: Use ExchangeNode instead. Kept for backward compatibility.
    """
    id: str = Field(default_factory=generate_node_id, description="Unique identifier for the node")
    content: str = Field(description="The actual message text")
    summary: Optional[str] = Field(default=None, description="Brief summary for display in graph nodes")
    role: Literal["user", "assistant"] = Field(description="Who sent this message")
    parent_id: Optional[str] = Field(default=None, description="Reference to parent node (null for root)")
    children_ids: List[str] = Field(default_factory=list, description="Array of child node IDs")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    
    def model_post_init(self, __context: Any) -> None:
        """Set default metadata values after model initialization."""
        if "timestamp" not in self.metadata:
            self.metadata["timestamp"] = datetime.now().isoformat()
        
        # Auto-generate summary if not provided
        if self.summary is None or not self.summary:
            # Take first 50 characters as summary
            self.summary = (self.content[:50] + "...") if len(self.content) > 50 else self.content


class ExchangeTree(BaseModel):
    """
    Represents the complete conversation tree structure using exchanges.
    
    Contains all exchanges and tracks the current conversation path.
    """
    id: str = Field(default_factory=generate_exchange_id, description="Unique identifier for the conversation")
    exchanges: Dict[str, ExchangeNode] = Field(default_factory=dict, description="Map of exchange ID to exchange")
    root_id: Optional[str] = Field(default=None, description="ID of the root exchange")
    current_path: List[str] = Field(default_factory=list, description="Array of exchange IDs from root to current position")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Conversation-level metadata")
    
    def model_post_init(self, __context: Any) -> None:
        """Set default metadata values after model initialization."""
        if "created_at" not in self.metadata:
            self.metadata["created_at"] = datetime.now().isoformat()
    
    def add_exchange(self, exchange: ExchangeNode, parent_id: Optional[str] = None) -> None:
        """
        Add an exchange to the tree.
        
        Args:
            exchange: The exchange to add
            parent_id: ID of parent exchange (None for root exchange)
        """
        # Set parent relationship
        if parent_id is not None:
            exchange.parent_id = parent_id
            # Add to parent's children
            if parent_id in self.exchanges:
                self.exchanges[parent_id].children_ids.append(exchange.id)
        else:
            # This is the root exchange
            if self.root_id is None:
                self.root_id = exchange.id
                self.current_path = [exchange.id]
        
        # Add to exchanges map
        self.exchanges[exchange.id] = exchange
    
    def get_path_to_exchange(self, exchange_id: str) -> List[str]:
        """
        Get the path from root to the specified exchange.
        
        Args:
            exchange_id: Target exchange ID
            
        Returns:
            List of exchange IDs from root to target exchange
        """
        if exchange_id not in self.exchanges:
            return []
        
        path = []
        current_id = exchange_id
        
        # Walk up the tree to root
        while current_id is not None:
            path.insert(0, current_id)
            current_exchange = self.exchanges.get(current_id)
            current_id = current_exchange.parent_id if current_exchange else None
        
        return path
    
    def delete_exchange(self, exchange_id: str) -> bool:
        """
        Delete an exchange and all its descendants.
        
        Args:
            exchange_id: ID of exchange to delete
            
        Returns:
            True if exchange was deleted, False if not found
        """
        if exchange_id not in self.exchanges:
            return False
        
        exchange = self.exchanges[exchange_id]
        
        # Remove from parent's children list
        if exchange.parent_id and exchange.parent_id in self.exchanges:
            parent = self.exchanges[exchange.parent_id]
            if exchange_id in parent.children_ids:
                parent.children_ids.remove(exchange_id)
        
        # Recursively delete all children
        children_to_delete = exchange.children_ids.copy()
        for child_id in children_to_delete:
            self.delete_exchange(child_id)
        
        # Delete the exchange itself
        del self.exchanges[exchange_id]
        
        # Update current path if necessary
        if exchange_id in self.current_path:
            # Find the last valid exchange in the path
            valid_path = []
            for path_exchange_id in self.current_path:
                if path_exchange_id in self.exchanges:
                    valid_path.append(path_exchange_id)
                else:
                    break
            self.current_path = valid_path
        
        return True


class ConversationTree(BaseModel):
    """
    Legacy: Represents the complete conversation tree structure.
    
    DEPRECATED: Use ExchangeTree instead. Kept for backward compatibility.
    """
    id: str = Field(default_factory=generate_node_id, description="Unique identifier for the conversation")
    nodes: Dict[str, ConversationNode] = Field(default_factory=dict, description="Map of node ID to node")
    root_id: Optional[str] = Field(default=None, description="ID of the root node")
    current_path: List[str] = Field(default_factory=list, description="Array of node IDs from root to current position")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Conversation-level metadata")
    
    def model_post_init(self, __context: Any) -> None:
        """Set default metadata values after model initialization."""
        if "created_at" not in self.metadata:
            self.metadata["created_at"] = datetime.now().isoformat()
    
    def add_node(self, node: ConversationNode, parent_id: Optional[str] = None) -> None:
        """
        Add a node to the tree.
        
        Args:
            node: The node to add
            parent_id: ID of parent node (None for root node)
        """
        # Set parent relationship
        if parent_id is not None:
            node.parent_id = parent_id
            # Add to parent's children
            if parent_id in self.nodes:
                self.nodes[parent_id].children_ids.append(node.id)
        else:
            # This is the root node
            if self.root_id is None:
                self.root_id = node.id
                self.current_path = [node.id]
        
        # Add to nodes map
        self.nodes[node.id] = node
    
    def get_path_to_node(self, node_id: str) -> List[str]:
        """
        Get the path from root to the specified node.
        
        Args:
            node_id: Target node ID
            
        Returns:
            List of node IDs from root to target node
        """
        if node_id not in self.nodes:
            return []
        
        path = []
        current_id = node_id
        
        # Walk up the tree to root
        while current_id is not None:
            path.insert(0, current_id)
            current_node = self.nodes.get(current_id)
            current_id = current_node.parent_id if current_node else None
        
        return path
    
    def delete_node(self, node_id: str) -> bool:
        """
        Delete a node and all its descendants.
        
        Args:
            node_id: ID of node to delete
            
        Returns:
            True if node was deleted, False if not found
        """
        if node_id not in self.nodes:
            return False
        
        node = self.nodes[node_id]
        
        # Remove from parent's children list
        if node.parent_id and node.parent_id in self.nodes:
            parent = self.nodes[node.parent_id]
            if node_id in parent.children_ids:
                parent.children_ids.remove(node_id)
        
        # Recursively delete all children
        children_to_delete = node.children_ids.copy()
        for child_id in children_to_delete:
            self.delete_node(child_id)
        
        # Delete the node itself
        del self.nodes[node_id]
        
        # Update current path if necessary
        if node_id in self.current_path:
            # Find the last valid node in the path
            valid_path = []
            for path_node_id in self.current_path:
                if path_node_id in self.nodes:
                    valid_path.append(path_node_id)
                else:
                    break
            self.current_path = valid_path
        
        return True

    # Legacy methods for backward compatibility
    def add_node(self, node: ConversationNode, parent_id: Optional[str] = None) -> None:
        """Legacy method - kept for backward compatibility."""
        # This would need conversion logic if we want to maintain backward compatibility
        pass
    
    def get_path_to_node(self, node_id: str) -> List[str]:
        """Legacy method - kept for backward compatibility."""
        return []
    
    def delete_node(self, node_id: str) -> bool:
        """Legacy method - kept for backward compatibility."""
        return False


# Request/Response models for API endpoints
class CreateExchangeRequest(BaseModel):
    """Request model for creating a new exchange."""
    user_content: str = Field(description="The user message content")
    parent_id: Optional[str] = Field(default=None, description="Parent exchange ID")
    user_summary: Optional[str] = Field(default=None, description="Optional user summary (auto-generated if not provided)")


class CreateConversationRequest(BaseModel):
    """Request model for creating a new conversation."""
    initial_message: Optional[str] = Field(default=None, description="Optional initial message")


class ExchangeTreeResponse(BaseModel):
    """Response model for exchange tree data."""
    conversation: ExchangeTree = Field(description="The exchange tree")


class ExchangeResponse(BaseModel):
    """Response model for exchange data."""
    exchange: ExchangeNode = Field(description="The exchange")


class PathResponse(BaseModel):
    """Response model for path data."""
    path: List[str] = Field(description="Array of exchange IDs from root to target")
    exchanges: List[ExchangeNode] = Field(description="The actual exchanges in the path")


class ChatRequest(BaseModel):
    """Request model for sending a chat message."""
    message: str = Field(description="The user message to send")
    conversation_id: str = Field(description="ID of the conversation to add the message to")
    parent_id: Optional[str] = Field(default=None, description="Parent exchange ID (defaults to last exchange in current path)")
    system_prompt: Optional[str] = Field(default=None, description="Optional system prompt for context")


class ChatResponse(BaseModel):
    """Response model for chat interactions."""
    exchange: ExchangeNode = Field(description="The complete exchange (user + assistant) that was created")
    updated_conversation: ExchangeTree = Field(description="The updated exchange tree")


# Legacy models for backward compatibility
class CreateNodeRequest(BaseModel):
    """DEPRECATED: Request model for creating a new node."""
    content: str = Field(description="The message content")
    role: Literal["user", "assistant"] = Field(description="Message role")
    parent_id: Optional[str] = Field(default=None, description="Parent node ID")
    summary: Optional[str] = Field(default=None, description="Optional summary (auto-generated if not provided)")


class ConversationResponse(BaseModel):
    """DEPRECATED: Response model for conversation data."""
    conversation: ConversationTree = Field(description="The conversation tree")


class NodeResponse(BaseModel):
    """DEPRECATED: Response model for node data."""
    node: ConversationNode = Field(description="The conversation node")
