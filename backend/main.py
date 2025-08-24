"""
Chat Tree API

FastAPI backend for the chat-tree conversation visualization application.
"""
import logging
from typing import List
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from models import (
    ConversationTree, ConversationNode, CreateNodeRequest, 
    CreateConversationRequest, ConversationResponse, NodeResponse, 
    PathResponse, ChatRequest, ChatResponse
)
from storage import storage
from openai_service import openai_service

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Chat Tree API", 
    version="1.0.0",
    description="API for managing conversation trees and nodes"
)

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Frontend dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Chat Tree API is running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    stats = storage.get_stats()
    return {
        "status": "healthy",
        "storage_stats": stats
    }

# Conversation Management Endpoints

@app.post("/api/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(request: CreateConversationRequest):
    """
    Create a new conversation tree.
    
    Optionally creates an initial message node if provided.
    """
    try:
        # Create new conversation
        conversation = ConversationTree()
        
        # Add initial message if provided
        if request.initial_message:
            initial_node = ConversationNode(
                content=request.initial_message,
                role="user"
            )
            conversation.add_node(initial_node)
        
        # Store the conversation
        stored_conversation = storage.create_conversation(conversation)
        
        logger.info(f"Created new conversation {stored_conversation.id}")
        return ConversationResponse(conversation=stored_conversation)
        
    except Exception as e:
        logger.error(f"Error creating conversation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create conversation"
        )

@app.get("/api/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(conversation_id: str):
    """Get a conversation tree by ID."""
    conversation = storage.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation {conversation_id} not found"
        )
    
    return ConversationResponse(conversation=conversation)

@app.delete("/api/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(conversation_id: str):
    """Delete a conversation."""
    success = storage.delete_conversation(conversation_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation {conversation_id} not found"
        )

# Node Operations Endpoints

@app.post("/api/nodes", response_model=NodeResponse, status_code=status.HTTP_201_CREATED)
async def create_node(request: CreateNodeRequest, conversation_id: str):
    """
    Create a new node in a conversation.
    
    Args:
        request: Node creation details
        conversation_id: The conversation to add the node to
    """
    try:
        # Create the new node
        new_node = ConversationNode(
            content=request.content,
            role=request.role,
            summary=request.summary
        )
        
        # Add to conversation
        updated_conversation = storage.add_node_to_conversation(
            conversation_id, new_node, request.parent_id
        )
        
        if not updated_conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conversation {conversation_id} not found"
            )
        
        logger.info(f"Created node {new_node.id} in conversation {conversation_id}")
        return NodeResponse(node=new_node)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating node: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create node"
        )

@app.get("/api/nodes/{node_id}", response_model=NodeResponse)
async def get_node(node_id: str, conversation_id: str):
    """Get a single node by ID."""
    node = storage.get_node(conversation_id, node_id)
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node {node_id} not found in conversation {conversation_id}"
        )
    
    return NodeResponse(node=node)

@app.delete("/api/nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_node(node_id: str, conversation_id: str):
    """Delete a node and all its children."""
    updated_conversation = storage.delete_node_from_conversation(conversation_id, node_id)
    if not updated_conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node {node_id} not found in conversation {conversation_id}"
        )

@app.get("/api/paths/{node_id}", response_model=PathResponse)
async def get_path_to_node(node_id: str, conversation_id: str):
    """Get the path from root to the specified node."""
    conversation = storage.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation {conversation_id} not found"
        )
    
    path = conversation.get_path_to_node(node_id)
    if not path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node {node_id} not found in conversation {conversation_id}"
        )
    
    # Get the actual nodes in the path
    path_nodes = []
    for path_node_id in path:
        node = conversation.nodes.get(path_node_id)
        if node:
            path_nodes.append(node)
    
    return PathResponse(path=path, nodes=path_nodes)

# LLM Interaction Endpoints

@app.post("/api/chat", response_model=ChatResponse, status_code=status.HTTP_200_OK)
async def send_chat_message(request: ChatRequest):
    """
    Send a message to the LLM and get a response.
    
    Creates a user node with the message, sends conversation history to OpenAI,
    and creates an assistant node with the response.
    """
    try:
        logger.info(f"Chat request for conversation {request.conversation_id}")
        
        # Debug: List all available conversations
        available_conversations = storage.list_conversations()
        logger.info(f"Available conversations: {available_conversations}")
        
        # Get the conversation
        conversation = storage.get_conversation(request.conversation_id)
        if not conversation:
            logger.error(f"Conversation {request.conversation_id} not found. Available: {available_conversations}")
            
            # Auto-recovery: Try to create a new conversation with the same ID
            logger.info(f"Attempting to auto-create missing conversation {request.conversation_id}")
            try:
                new_conversation = ConversationTree()
                # Force the ID to match what the frontend expects
                new_conversation.id = request.conversation_id
                conversation = storage.create_conversation(new_conversation)
                logger.info(f"Auto-created conversation {conversation.id}")
            except Exception as e:
                logger.error(f"Failed to auto-create conversation: {e}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Conversation {request.conversation_id} not found and could not be recreated"
                )
        
        # Determine parent node ID
        parent_id = request.parent_id
        if parent_id is None and conversation.current_path:
            # Default to last node in current path
            parent_id = conversation.current_path[-1]
        
        # Create user message node
        user_node = ConversationNode(
            content=request.message,
            role="user"
        )
        
        # Add user node to conversation
        updated_conversation = storage.add_node_to_conversation(
            request.conversation_id, user_node, parent_id
        )
        
        if not updated_conversation:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to add user message to conversation"
            )
        
        # Update current path to include the new user node
        updated_conversation.current_path = updated_conversation.get_path_to_node(user_node.id)
        
        # Get conversation history for OpenAI
        conversation_history = []
        for node_id in updated_conversation.current_path:
            node = updated_conversation.nodes.get(node_id)
            if node:
                conversation_history.append(node)
        
        logger.info(f"Sending {len(conversation_history)} messages to OpenAI for conversation {request.conversation_id}")
        
        # Get response from OpenAI
        assistant_response = await openai_service.generate_chat_response(
            conversation_history, 
            request.system_prompt
        )
        
        # Create assistant response node  
        assistant_node = ConversationNode(
            content=assistant_response,
            role="assistant"
        )
        
        # Add assistant node to conversation
        final_conversation = storage.add_node_to_conversation(
            request.conversation_id, assistant_node, user_node.id
        )
        
        if not final_conversation:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to add assistant response to conversation"
            )
        
        # Update current path to include the new assistant node
        final_conversation.current_path = final_conversation.get_path_to_node(assistant_node.id)
        
        # Update stored conversation with new current path
        storage.update_conversation(final_conversation)
        
        logger.info(f"Chat completed - created user node {user_node.id} and assistant node {assistant_node.id}")
        
        return ChatResponse(
            user_node=user_node,
            assistant_node=assistant_node,
            updated_conversation=final_conversation
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat processing failed: {str(e)}"
        )

# Development/Debug Endpoints

@app.get("/api/conversations", response_model=List[str])
async def list_conversations():
    """List all conversation IDs (for development/debugging)."""
    conversation_ids = storage.list_conversations()
    logger.info(f"Current conversations in storage: {conversation_ids}")
    return conversation_ids

@app.get("/api/debug/storage")
async def debug_storage():
    """Debug endpoint to see storage contents."""
    stats = storage.get_stats()
    conversation_ids = storage.list_conversations()
    return {
        "stats": stats,
        "conversation_ids": conversation_ids,
        "total_conversations": len(conversation_ids)
    }
