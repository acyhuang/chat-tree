"""
Chat Tree API

FastAPI backend for the chat-tree conversation visualization application.
"""
import logging
import json
from typing import List
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from models import (
    ExchangeTree, ExchangeNode, CreateExchangeRequest,
    CreateConversationRequest, ExchangeTreeResponse, ExchangeResponse, 
    PathResponse, ChatRequest, ChatResponse,
    # Legacy models for backward compatibility
    ConversationTree, ConversationNode, CreateNodeRequest, 
    ConversationResponse, NodeResponse
)
from storage import storage, legacy_storage
from openai_service import openai_service

# Configure logging with environment-based levels
import os
DEBUG_MODE = os.getenv('DEBUG', 'false').lower() == 'true'
log_level = logging.DEBUG if DEBUG_MODE else logging.INFO
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
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

# Exchange-based Conversation Management Endpoints

@app.post("/api/conversations", response_model=ExchangeTreeResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(request: CreateConversationRequest):
    """
    Create a new exchange-based conversation tree.
    
    Optionally creates an initial exchange if initial message is provided.
    """
    try:
        # Create new exchange tree
        conversation = ExchangeTree()
        
        # Add initial exchange if provided
        if request.initial_message:
            initial_exchange = ExchangeNode(
                user_content=request.initial_message,
                user_summary=""  # Will be auto-generated
            )
            conversation.add_exchange(initial_exchange)
        
        # Store the conversation
        stored_conversation = storage.create_conversation(conversation)
        
        logger.debug(f"Created new exchange tree {stored_conversation.id}")
        return ExchangeTreeResponse(conversation=stored_conversation)
        
    except Exception as e:
        logger.error(f"Error creating conversation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create conversation"
        )

@app.get("/api/conversations/{conversation_id}", response_model=ExchangeTreeResponse)
async def get_conversation(conversation_id: str):
    """Get an exchange tree by ID."""
    conversation = storage.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation {conversation_id} not found"
        )
    
    return ExchangeTreeResponse(conversation=conversation)

@app.delete("/api/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(conversation_id: str):
    """Delete a conversation."""
    success = storage.delete_conversation(conversation_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation {conversation_id} not found"
        )

# Exchange Operations Endpoints

@app.post("/api/exchanges", response_model=ExchangeResponse, status_code=status.HTTP_201_CREATED)
async def create_exchange(request: CreateExchangeRequest, conversation_id: str):
    """
    Create a new exchange in a conversation.
    
    Args:
        request: Exchange creation details
        conversation_id: The conversation to add the exchange to
    """
    try:
        # Create the new exchange
        new_exchange = ExchangeNode(
            user_content=request.user_content,
            user_summary=request.user_summary or ""  # Auto-generated if empty
        )
        
        # Add to conversation
        updated_conversation = storage.add_exchange_to_conversation(
            conversation_id, new_exchange, request.parent_id
        )
        
        if not updated_conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conversation {conversation_id} not found"
            )
        
        logger.debug(f"Created exchange {new_exchange.id} in conversation {conversation_id}")
        return ExchangeResponse(exchange=new_exchange)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating exchange: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create exchange"
        )

@app.get("/api/exchanges/{exchange_id}", response_model=ExchangeResponse)
async def get_exchange(exchange_id: str, conversation_id: str):
    """Get a single exchange by ID."""
    exchange = storage.get_exchange(conversation_id, exchange_id)
    if not exchange:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exchange {exchange_id} not found in conversation {conversation_id}"
        )
    
    return ExchangeResponse(exchange=exchange)

@app.delete("/api/exchanges/{exchange_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exchange(exchange_id: str, conversation_id: str):
    """Delete an exchange and all its children."""
    updated_conversation = storage.delete_exchange_from_conversation(conversation_id, exchange_id)
    if not updated_conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exchange {exchange_id} not found in conversation {conversation_id}"
        )

@app.get("/api/exchange-paths/{exchange_id}", response_model=PathResponse)
async def get_path_to_exchange(exchange_id: str, conversation_id: str):
    """Get the path from root to the specified exchange."""
    conversation = storage.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation {conversation_id} not found"
        )
    
    path = conversation.get_path_to_exchange(exchange_id)
    if not path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exchange {exchange_id} not found in conversation {conversation_id}"
        )
    
    # Get the actual exchanges in the path
    path_exchanges = []
    for path_exchange_id in path:
        exchange = conversation.exchanges.get(path_exchange_id)
        if exchange:
            path_exchanges.append(exchange)
    
    return PathResponse(path=path, exchanges=path_exchanges)

# Legacy Node Operations Endpoints

@app.post("/api/legacy/nodes", response_model=NodeResponse, status_code=status.HTTP_201_CREATED)
async def create_node(request: CreateNodeRequest, conversation_id: str):
    """
    DEPRECATED: Create a new node in a conversation.
    
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
        
        # Add to conversation using legacy storage
        updated_conversation = legacy_storage.add_node_to_conversation(
            conversation_id, new_node, request.parent_id
        )
        
        if not updated_conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conversation {conversation_id} not found"
            )
        
        logger.debug(f"Created node {new_node.id} in conversation {conversation_id}")
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

@app.post("/api/chat/stream")
async def stream_chat_message(request: ChatRequest):
    """
    Stream a message to the LLM and get a streaming response using exchange-based structure.
    
    Creates an exchange with user message, sends conversation history to OpenAI,
    and streams the assistant response in real-time.
    """
    try:
        logger.info(f"🚀 Starting streaming chat session for conversation {request.conversation_id}")
        
        # Get the conversation
        conversation = storage.get_conversation(request.conversation_id)
        if not conversation:
            # Auto-recovery: Try to create a new conversation
            logger.info(f"✨ Auto-creating missing conversation {request.conversation_id}")
            new_conversation = ExchangeTree()
            new_conversation.id = request.conversation_id
            conversation = storage.create_conversation(new_conversation)
        
        # Determine parent exchange ID
        parent_id = request.parent_id
        if parent_id is None and conversation.current_path:
            parent_id = conversation.current_path[-1]
        
        # Create new exchange with user message
        exchange = ExchangeNode(
            user_content=request.message,
            user_summary="",
            assistant_loading=True
        )
        
        # Add exchange to conversation
        updated_conversation = storage.add_exchange_to_conversation(
            request.conversation_id, exchange, parent_id
        )
        
        if not updated_conversation:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to add exchange to conversation"
            )
        
        # Update current path
        updated_conversation.current_path = updated_conversation.get_path_to_exchange(exchange.id)
        
        # Get conversation history for OpenAI
        conversation_history = []
        for exchange_id in updated_conversation.current_path:
            ex = updated_conversation.exchanges.get(exchange_id)
            if ex:
                user_msg = ConversationNode(content=ex.user_content, role="user", summary=ex.user_summary)
                conversation_history.append(user_msg)
                
                if ex.assistant_content and ex.is_complete:
                    assistant_msg = ConversationNode(content=ex.assistant_content, role="assistant", summary=ex.assistant_summary or "")
                    conversation_history.append(assistant_msg)
        
        async def generate_stream():
            """Generator function for streaming response"""
            try:
                # Send initial message with exchange info
                initial_data = {
                    "type": "exchange_created",
                    "exchange_id": exchange.id,
                    "conversation_id": request.conversation_id
                }
                yield f"data: {json.dumps(initial_data)}\n\n"
                
                # Stream assistant response
                full_response = ""
                chunk_count = 0
                async for chunk in openai_service.generate_chat_response_stream(
                    conversation_history, request.system_prompt
                ):
                    full_response += chunk
                    chunk_count += 1
                    chunk_data = {
                        "type": "content",
                        "data": chunk
                    }
                    # Removed per-chunk logging for performance
                    yield f"data: {json.dumps(chunk_data)}\n\n"
                
                # Complete the exchange
                exchange.assistant_content = full_response
                exchange.assistant_loading = False
                exchange.is_complete = True
                
                # Update exchange in storage
                final_conversation = storage.update_exchange(request.conversation_id, exchange)
                if final_conversation:
                    final_conversation.current_path = final_conversation.get_path_to_exchange(exchange.id)
                    storage.update_conversation(final_conversation)
                
                # Send completion message
                completion_data = {
                    "type": "done",
                    "exchange": exchange.model_dump()
                }
                logger.info(f"📝 Exchange {exchange.id} completed - {len(full_response)} characters")
                yield f"data: {json.dumps(completion_data)}\n\n"
                
            except Exception as e:
                logger.error(f"Error in streaming generator: {e}")
                error_data = {
                    "type": "error",
                    "message": str(e)
                }
                yield f"data: {json.dumps(error_data)}\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # Disable nginx buffering
                "Access-Control-Allow-Origin": "http://localhost:5173",
                "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            }
        )
        
    except Exception as e:
        logger.error(f"Error in streaming chat endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Streaming chat failed: {str(e)}"
        )

@app.post("/api/chat", response_model=ChatResponse, status_code=status.HTTP_200_OK)
async def send_chat_message(request: ChatRequest):
    """
    Send a message to the LLM and get a response using exchange-based structure.
    
    Creates an exchange with user message, sends conversation history to OpenAI,
    and completes the exchange with the assistant response.
    """
    try:
        logger.info(f"💬 Processing chat request for conversation {request.conversation_id}")
        
        # Debug: List all available conversations
        available_conversations = storage.list_conversations()
        logger.info(f"Available exchange trees: {available_conversations}")
        
        # Get the conversation
        conversation = storage.get_conversation(request.conversation_id)
        if not conversation:
            logger.error(f"Conversation {request.conversation_id} not found. Available: {available_conversations}")
            
            # Auto-recovery: Try to create a new conversation with the same ID
            logger.info(f"Attempting to auto-create missing conversation {request.conversation_id}")
            try:
                new_conversation = ExchangeTree()
                # Force the ID to match what the frontend expects
                new_conversation.id = request.conversation_id
                conversation = storage.create_conversation(new_conversation)
                logger.info(f"✅ Auto-created conversation {conversation.id}")
            except Exception as e:
                logger.error(f"Failed to auto-create conversation: {e}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Conversation {request.conversation_id} not found and could not be recreated"
                )
        
        # Determine parent exchange ID
        parent_id = request.parent_id
        if parent_id is None and conversation.current_path:
            # Default to last exchange in current path
            parent_id = conversation.current_path[-1]
        
        # Create new exchange with user message
        exchange = ExchangeNode(
            user_content=request.message,
            user_summary="",  # Auto-generated
            assistant_loading=True  # Mark as loading
        )
        
        # Add exchange to conversation
        updated_conversation = storage.add_exchange_to_conversation(
            request.conversation_id, exchange, parent_id
        )
        
        if not updated_conversation:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to add exchange to conversation"
            )
        
        # Update current path to include the new exchange
        updated_conversation.current_path = updated_conversation.get_path_to_exchange(exchange.id)
        
        # Get conversation history for OpenAI (convert exchanges to individual messages)
        conversation_history = []
        for exchange_id in updated_conversation.current_path:
            ex = updated_conversation.exchanges.get(exchange_id)
            if ex:
                # Add user message
                user_msg = ConversationNode(content=ex.user_content, role="user", summary=ex.user_summary)
                conversation_history.append(user_msg)
                
                # Add assistant message if available
                if ex.assistant_content and ex.is_complete:
                    assistant_msg = ConversationNode(content=ex.assistant_content, role="assistant", summary=ex.assistant_summary or "")
                    conversation_history.append(assistant_msg)
        
        logger.debug(f"Sending {len(conversation_history)} messages to OpenAI for conversation {request.conversation_id}")
        
        # Get response from OpenAI
        assistant_response = await openai_service.generate_chat_response(
            conversation_history, 
            request.system_prompt
        )
        
        # Complete the exchange with assistant response
        exchange.assistant_content = assistant_response
        exchange.assistant_loading = False
        exchange.is_complete = True
        # assistant_summary will be auto-generated by the model
        
        # Update the exchange in storage
        final_conversation = storage.update_exchange(request.conversation_id, exchange)
        
        if not final_conversation:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update exchange with assistant response"
            )
        
        # Update current path to include the completed exchange
        final_conversation.current_path = final_conversation.get_path_to_exchange(exchange.id)
        
        # Update stored conversation with new current path
        storage.update_conversation(final_conversation)
        
        logger.debug(f"Chat completed - created exchange {exchange.id} with user message and assistant response")
        
        return ChatResponse(
            exchange=exchange,
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
    logger.debug(f"Current conversations in storage: {conversation_ids}")
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
