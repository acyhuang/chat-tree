"""
In-memory storage service for conversations.

Provides a simple in-memory storage solution for the chat-tree prototype.
All data is lost when the server restarts.
"""
from typing import Dict, Optional, List
from models import ConversationTree, ConversationNode
import logging

# Set up logging
logger = logging.getLogger(__name__)


class ConversationStorage:
    """
    In-memory storage for conversation trees.
    
    This is a simple implementation that stores all data in memory.
    In a production system, this would be replaced with a proper database.
    """
    
    def __init__(self):
        """Initialize empty storage."""
        self._conversations: Dict[str, ConversationTree] = {}
        logger.info("Initialized ConversationStorage with in-memory storage")
    
    def create_conversation(self, conversation: ConversationTree) -> ConversationTree:
        """
        Store a new conversation.
        
        Args:
            conversation: The conversation to store
            
        Returns:
            The stored conversation
        """
        self._conversations[conversation.id] = conversation
        logger.info(f"Created conversation {conversation.id}")
        return conversation
    
    def get_conversation(self, conversation_id: str) -> Optional[ConversationTree]:
        """
        Retrieve a conversation by ID.
        
        Args:
            conversation_id: The conversation ID
            
        Returns:
            The conversation if found, None otherwise
        """
        conversation = self._conversations.get(conversation_id)
        if conversation:
            logger.debug(f"Retrieved conversation {conversation_id}")
        else:
            logger.warning(f"Conversation {conversation_id} not found")
        return conversation
    
    def update_conversation(self, conversation: ConversationTree) -> ConversationTree:
        """
        Update an existing conversation.
        
        Args:
            conversation: The updated conversation
            
        Returns:
            The updated conversation
        """
        if conversation.id in self._conversations:
            self._conversations[conversation.id] = conversation
            logger.info(f"Updated conversation {conversation.id}")
            return conversation
        else:
            logger.error(f"Cannot update non-existent conversation {conversation.id}")
            raise ValueError(f"Conversation {conversation.id} not found")
    
    def delete_conversation(self, conversation_id: str) -> bool:
        """
        Delete a conversation.
        
        Args:
            conversation_id: The conversation ID to delete
            
        Returns:
            True if deleted, False if not found
        """
        if conversation_id in self._conversations:
            del self._conversations[conversation_id]
            logger.info(f"Deleted conversation {conversation_id}")
            return True
        else:
            logger.warning(f"Cannot delete non-existent conversation {conversation_id}")
            return False
    
    def list_conversations(self) -> List[str]:
        """
        Get a list of all conversation IDs.
        
        Returns:
            List of conversation IDs
        """
        return list(self._conversations.keys())
    
    def add_node_to_conversation(self, conversation_id: str, node: ConversationNode, parent_id: Optional[str] = None) -> Optional[ConversationTree]:
        """
        Add a node to an existing conversation.
        
        Args:
            conversation_id: The conversation to add to
            node: The node to add
            parent_id: ID of parent node (None for root)
            
        Returns:
            The updated conversation, or None if conversation not found
        """
        conversation = self.get_conversation(conversation_id)
        if not conversation:
            return None
        
        conversation.add_node(node, parent_id)
        logger.info(f"Added node {node.id} to conversation {conversation_id}")
        return conversation
    
    def get_node(self, conversation_id: str, node_id: str) -> Optional[ConversationNode]:
        """
        Get a specific node from a conversation.
        
        Args:
            conversation_id: The conversation ID
            node_id: The node ID
            
        Returns:
            The node if found, None otherwise
        """
        conversation = self.get_conversation(conversation_id)
        if not conversation:
            return None
        
        node = conversation.nodes.get(node_id)
        if node:
            logger.debug(f"Retrieved node {node_id} from conversation {conversation_id}")
        else:
            logger.warning(f"Node {node_id} not found in conversation {conversation_id}")
        return node
    
    def delete_node_from_conversation(self, conversation_id: str, node_id: str) -> Optional[ConversationTree]:
        """
        Delete a node from a conversation.
        
        Args:
            conversation_id: The conversation ID
            node_id: The node ID to delete
            
        Returns:
            The updated conversation, or None if conversation or node not found
        """
        conversation = self.get_conversation(conversation_id)
        if not conversation:
            return None
        
        if conversation.delete_node(node_id):
            logger.info(f"Deleted node {node_id} from conversation {conversation_id}")
            return conversation
        else:
            logger.warning(f"Could not delete node {node_id} from conversation {conversation_id}")
            return None
    
    def get_path_to_node(self, conversation_id: str, node_id: str) -> Optional[List[str]]:
        """
        Get the path from root to a specific node.
        
        Args:
            conversation_id: The conversation ID
            node_id: The target node ID
            
        Returns:
            List of node IDs from root to target, or None if not found
        """
        conversation = self.get_conversation(conversation_id)
        if not conversation:
            return None
        
        path = conversation.get_path_to_node(node_id)
        logger.debug(f"Retrieved path to node {node_id} in conversation {conversation_id}: {path}")
        return path
    
    def get_stats(self) -> Dict[str, int]:
        """
        Get storage statistics.
        
        Returns:
            Dictionary with storage stats
        """
        total_nodes = sum(len(conv.nodes) for conv in self._conversations.values())
        return {
            "total_conversations": len(self._conversations),
            "total_nodes": total_nodes
        }


# Global storage instance
# In a production app, this would be dependency-injected
storage = ConversationStorage()
