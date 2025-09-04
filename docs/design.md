# chat-tree

## Project Overview
Experimental UI for chatting with LLMs. Represents the conversation as a graph of nodes, allowing for branching and context-building.

**Features:**
- Send messages to and receive messages from LLMs
- Stop generation of messages
- Show conversation as a tree of nodes where each node is a message
- Allow creation of leaf nodes (branching) and deletion of nodes
- Allow switching between paths from root to leaf (context)

**Scope:** Polished prototype, not production-ready.
- no user authentication
- no persistence between sessions

## Implementation

### Data Structures

**ExchangeNode:**
- `id`: unique identifier  
- `user_content`: the user message text
- `user_summary`: brief summary of user message for display
- `assistant_content`: the assistant response text (null if incomplete)
- `assistant_summary`: brief summary of assistant response
- `assistant_loading`: whether assistant response is being generated
- `is_complete`: whether both user and assistant parts are present
- `parent_id`: reference to parent exchange (null for root)
- `children_ids`: array of child exchange IDs
- `metadata`: timestamp, tokens, model used, etc.

**ExchangeTree:**
- `exchanges`: Map<id, ExchangeNode>
- `root_id`: starting point
- `current_path`: array of exchange IDs from root to current position

### State Management

**Zustand Store:**
- Chosen for lightweight, TypeScript-friendly state management
- Perfect for tree operations and prototype scope
- Single store containing:
  - `currentExchangeTree`: ExchangeTree instance
  - `isLoading`: loading state for async operations
  - `error`: error state for user feedback
- Actions for tree operations: createConversation, sendMessage, setCurrentPath, etc.
- Includes streaming support with real-time updates
- No providers needed, minimal re-renders

### User interface
Three primary components:
- Top navigation bar - help button
- Chat - shows current conversation branch in full, similar to a chat interface
- Tree - shows full conversation tree, with current branch highlighted
  - Custom tree component with vertical layout (root at top)
  - Pan/zoom functionality using react-flow
  - Branches extend downward, children at same height

Tree:
- each exchange node represents user-assistant exchange (two halves: user top, assistant bottom)
- assistant half shows loading state until response received
- branching only allowed after complete exchanges (assistant responses)
- selected exchange determines conversation context - chat displays root → selected exchange
- active branch highlighting shows same path as chat (root → selected exchange)
- inactive branches at reduced opacity, hover to full opacity
- nodes show truncated content preview or summary for both halves
- visual indicators for current path and branching points


### Interaction Design
- **Exchange preview**: Hover or click to preview exchange content
- **Context switching**: Click action reconstructs conversation path and updates chat panel
- **Core operations**: Send messages (creates exchanges), delete exchanges
- **Streaming support**: Real-time message generation with interrupt capability

### Tech Stack
- frontend: react 19 (typescript), tailwind, shadcn, zustand, @xyflow/react
- build tools: vite
- package manager: npm
- runtime: node.js 20.x LTS
- backend: python 3.11+, fastapi, uvicorn
- LLM API: OpenAI GPT-4o mini (streaming support)
- storage: in-memory (no persistence)
- structure: monorepo with separate frontend/ and backend/ folders
- dev ports: frontend 5173, backend 8000

### API Endpoints

**Conversation Management:**
- `GET /api/conversations/{id}` - Get full exchange tree
- `POST /api/conversations` - Create new conversation  
- `DELETE /api/conversations/{id}` - Delete conversation

**Exchange Operations:**
- `POST /api/exchanges` - Create new exchange (with parentId)
- `GET /api/exchanges/{id}` - Get single exchange
- `DELETE /api/exchanges/{id}` - Delete exchange + children
- `GET /api/exchange-paths/{exchangeId}` - Get path from root to exchange

**LLM Interaction:**
- `POST /api/chat/stream` - Stream message to LLM with real-time response
- `POST /api/chat` - Send message to LLM, create response exchange
- `POST /api/exchanges/save-interrupted` - Save interrupted streaming exchange