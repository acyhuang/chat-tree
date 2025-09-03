"""
In-memory storage service for conversations.

Provides a simple in-memory storage solution for the chat-tree prototype.
All data is lost when the server restarts.
"""
from typing import Dict, Optional, List
import logging

# Use string type hints to avoid circular imports
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from models import ExchangeTree, ExchangeNode, ConversationTree, ConversationNode

# Set up logging
logger = logging.getLogger(__name__)


class ExchangeStorage:
    """
    In-memory storage for exchange trees.
    
    This is a simple implementation that stores all data in memory.
    In a production system, this would be replaced with a proper database.
    """
    
    def __init__(self):
        """Initialize empty storage."""
        self._conversations: Dict[str, 'ExchangeTree'] = {}
        logger.info("Initialized ExchangeStorage with in-memory storage")
    
    def create_conversation(self, conversation: 'ExchangeTree') -> 'ExchangeTree':
        """
        Store a new conversation.
        
        Args:
            conversation: The conversation to store
            
        Returns:
            The stored conversation
        """
        self._conversations[conversation.id] = conversation
        logger.debug(f"Created conversation {conversation.id}")
        return conversation
    
    def get_conversation(self, conversation_id: str) -> Optional['ExchangeTree']:
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
    
    def update_conversation(self, conversation: 'ExchangeTree') -> 'ExchangeTree':
        """
        Update an existing conversation.
        
        Args:
            conversation: The updated conversation
            
        Returns:
            The updated conversation
        """
        if conversation.id in self._conversations:
            self._conversations[conversation.id] = conversation
            logger.debug(f"Updated conversation {conversation.id}")
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
            logger.debug(f"Deleted conversation {conversation_id}")
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
    
    def add_exchange_to_conversation(self, conversation_id: str, exchange: 'ExchangeNode', parent_id: Optional[str] = None) -> Optional['ExchangeTree']:
        """
        Add an exchange to an existing conversation.
        
        Args:
            conversation_id: The conversation to add to
            exchange: The exchange to add
            parent_id: ID of parent exchange (None for root)
            
        Returns:
            The updated conversation, or None if conversation not found
        """
        conversation = self.get_conversation(conversation_id)
        if not conversation:
            return None
        
        conversation.add_exchange(exchange, parent_id)
        logger.debug(f"Added exchange {exchange.id} to conversation {conversation_id}")
        return conversation
    
    def get_exchange(self, conversation_id: str, exchange_id: str) -> Optional['ExchangeNode']:
        """
        Get a specific exchange from a conversation.
        
        Args:
            conversation_id: The conversation ID
            exchange_id: The exchange ID
            
        Returns:
            The exchange if found, None otherwise
        """
        conversation = self.get_conversation(conversation_id)
        if not conversation:
            return None
        
        exchange = conversation.exchanges.get(exchange_id)
        if exchange:
            logger.debug(f"Retrieved exchange {exchange_id} from conversation {conversation_id}")
        else:
            logger.warning(f"Exchange {exchange_id} not found in conversation {conversation_id}")
        return exchange
    
    def update_exchange(self, conversation_id: str, exchange: 'ExchangeNode') -> Optional['ExchangeTree']:
        """
        Update an exchange in a conversation (useful for adding assistant responses).
        
        Args:
            conversation_id: The conversation ID
            exchange: The updated exchange
            
        Returns:
            The updated conversation, or None if conversation or exchange not found
        """
        conversation = self.get_conversation(conversation_id)
        if not conversation or exchange.id not in conversation.exchanges:
            return None
        
        conversation.exchanges[exchange.id] = exchange
        logger.debug(f"Updated exchange {exchange.id} in conversation {conversation_id}")
        return conversation
    
    def delete_exchange_from_conversation(self, conversation_id: str, exchange_id: str) -> Optional['ExchangeTree']:
        """
        Delete an exchange from a conversation.
        
        Args:
            conversation_id: The conversation ID
            exchange_id: The exchange ID to delete
            
        Returns:
            The updated conversation, or None if conversation or exchange not found
        """
        conversation = self.get_conversation(conversation_id)
        if not conversation:
            return None
        
        if conversation.delete_exchange(exchange_id):
            logger.debug(f"Deleted exchange {exchange_id} from conversation {conversation_id}")
            return conversation
        else:
            logger.warning(f"Could not delete exchange {exchange_id} from conversation {conversation_id}")
            return None
    
    def get_path_to_exchange(self, conversation_id: str, exchange_id: str) -> Optional[List[str]]:
        """
        Get the path from root to a specific exchange.
        
        Args:
            conversation_id: The conversation ID
            exchange_id: The target exchange ID
            
        Returns:
            List of exchange IDs from root to target, or None if not found
        """
        conversation = self.get_conversation(conversation_id)
        if not conversation:
            return None
        
        path = conversation.get_path_to_exchange(exchange_id)
        logger.debug(f"Retrieved path to exchange {exchange_id} in conversation {conversation_id}: {path}")
        return path
    
    def get_stats(self) -> Dict[str, int]:
        """
        Get storage statistics.
        
        Returns:
            Dictionary with storage stats
        """
        total_exchanges = sum(len(conv.exchanges) for conv in self._conversations.values())
        return {
            "total_conversations": len(self._conversations),
            "total_exchanges": total_exchanges
        }


class ConversationStorage:
    """
    DEPRECATED: Legacy in-memory storage for conversation trees.
    
    Use ExchangeStorage instead. Kept for backward compatibility.
    """
    
    def __init__(self):
        """Initialize empty storage."""
        self._conversations: Dict[str, 'ConversationTree'] = {}
        logger.info("Initialized ConversationStorage with in-memory storage (DEPRECATED)")
    
    # Keep all legacy methods for backward compatibility
    def create_conversation(self, conversation: 'ConversationTree') -> 'ConversationTree':
        self._conversations[conversation.id] = conversation
        logger.debug(f"Created conversation {conversation.id} (legacy)")
        return conversation
    
    def get_conversation(self, conversation_id: str) -> Optional['ConversationTree']:
        return self._conversations.get(conversation_id)
    
    def update_conversation(self, conversation: 'ConversationTree') -> 'ConversationTree':
        if conversation.id in self._conversations:
            self._conversations[conversation.id] = conversation
            return conversation
        else:
            raise ValueError(f"Conversation {conversation.id} not found")
    
    def delete_conversation(self, conversation_id: str) -> bool:
        if conversation_id in self._conversations:
            del self._conversations[conversation_id]
            return True
        else:
            return False
    
    def list_conversations(self) -> List[str]:
        return list(self._conversations.keys())
    
    def add_node_to_conversation(self, conversation_id: str, node: 'ConversationNode', parent_id: Optional[str] = None) -> Optional['ConversationTree']:
        conversation = self.get_conversation(conversation_id)
        if not conversation:
            return None
        conversation.add_node(node, parent_id)
        return conversation
    
    def get_node(self, conversation_id: str, node_id: str) -> Optional['ConversationNode']:
        conversation = self.get_conversation(conversation_id)
        if not conversation:
            return None
        return conversation.nodes.get(node_id)
    
    def delete_node_from_conversation(self, conversation_id: str, node_id: str) -> Optional['ConversationTree']:
        conversation = self.get_conversation(conversation_id)
        if not conversation:
            return None
        if conversation.delete_node(node_id):
            return conversation
        else:
            return None
    
    def get_path_to_node(self, conversation_id: str, node_id: str) -> Optional[List[str]]:
        conversation = self.get_conversation(conversation_id)
        if not conversation:
            return None
        return conversation.get_path_to_node(node_id)
    
    def get_stats(self) -> Dict[str, int]:
        total_nodes = sum(len(conv.nodes) for conv in self._conversations.values())
        return {
            "total_conversations": len(self._conversations),
            "total_nodes": total_nodes
        }


# Global storage instances
# In a production app, this would be dependency-injected
storage = ExchangeStorage()
legacy_storage = ConversationStorage()  # For backward compatibility
