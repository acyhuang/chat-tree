"""
OpenAI service for chat-tree application.

Handles communication with OpenAI's API for generating LLM responses.
"""
import logging
import os
from typing import List, Optional
from openai import AsyncOpenAI
from dotenv import load_dotenv

from models import ConversationNode

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class OpenAIService:
    """Service for interacting with OpenAI's API."""
    
    def __init__(self):
        """Initialize the OpenAI service with API key and model configuration."""
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        
        if not self.api_key:
            raise ValueError(
                "OPENAI_API_KEY environment variable is required. "
                "Please set it in your .env file."
            )
        
        self.client = AsyncOpenAI(api_key=self.api_key)
        logger.info(f"OpenAI service initialized with model: {self.model}")
    
    async def generate_chat_response(
        self, 
        conversation_history: List[ConversationNode],
        system_prompt: Optional[str] = None
    ) -> str:
        """
        Generate a response from OpenAI given a conversation history.
        
        Args:
            conversation_history: List of conversation nodes representing the chat history
            system_prompt: Optional system prompt to provide context
            
        Returns:
            Generated response text
            
        Raises:
            Exception: If the API call fails
        """
        try:
            # Build messages for OpenAI API
            messages = []
            
            # Add system prompt if provided
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            
            # Convert conversation nodes to OpenAI message format
            for node in conversation_history:
                messages.append({
                    "role": node.role,
                    "content": node.content
                })
            
            logger.info(f"Sending {len(messages)} messages to OpenAI API")
            logger.debug(f"Messages: {messages}")
            
            # Make API call
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=2000,
            )
            
            # Extract response content
            if not response.choices or not response.choices[0].message:
                raise ValueError("Invalid response from OpenAI API")
            
            response_content = response.choices[0].message.content
            if not response_content:
                raise ValueError("Empty response from OpenAI API")
            
            # Log token usage if available
            if response.usage:
                logger.info(
                    f"OpenAI API usage - "
                    f"Prompt tokens: {response.usage.prompt_tokens}, "
                    f"Completion tokens: {response.usage.completion_tokens}, "
                    f"Total tokens: {response.usage.total_tokens}"
                )
            
            return response_content.strip()
            
        except Exception as e:
            logger.error(f"Error calling OpenAI API: {e}")
            raise Exception(f"Failed to generate response: {str(e)}")

    async def generate_chat_response_stream(
        self, 
        conversation_history: List[ConversationNode],
        system_prompt: Optional[str] = None
    ):
        """
        Generate a streaming response from OpenAI given a conversation history.
        
        Args:
            conversation_history: List of conversation nodes representing the chat history
            system_prompt: Optional system prompt to provide context
            
        Yields:
            Content chunks as they arrive from OpenAI
            
        Raises:
            Exception: If the API call fails
        """
        try:
            # Build messages for OpenAI API
            messages = []
            
            # Add system prompt if provided
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            
            # Convert conversation nodes to OpenAI message format
            for node in conversation_history:
                messages.append({
                    "role": node.role,
                    "content": node.content
                })
            
            logger.info(f"Sending {len(messages)} messages to OpenAI API (streaming)")
            logger.debug(f"Messages: {messages}")
            
            # Make streaming API call
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=2000,
                stream=True,
            )
            
            # Yield content chunks as they arrive
            full_content = ""
            chunk_count = 0
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    full_content += content
                    chunk_count += 1
                    logger.debug(f"Chunk {chunk_count}: '{content}' (length: {len(content)})")
                    yield content
            
            logger.info(f"Streaming completed - generated {len(full_content)} characters")
            
        except Exception as e:
            logger.error(f"Error in streaming OpenAI API call: {e}")
            raise Exception(f"Failed to generate streaming response: {str(e)}")
    
    def get_model_info(self) -> dict:
        """Get information about the configured model."""
        return {
            "model": self.model,
            "api_key_configured": bool(self.api_key)
        }

# Global service instance
openai_service = OpenAIService()
