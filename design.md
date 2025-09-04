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

**ConversationNode:**
- `id`: unique identifier  
- `content`: the actual message text
- `summary`: brief summary for display in graph nodes
- `role`: "user" | "assistant" 
- `parentId`: reference to parent node (null for root)
- `childrenIds`: array of child node IDs
- `metadata`: timestamp, tokens, model used, etc.

**ConversationTree:**
- `nodes`: Map<id, ConversationNode>
- `rootId`: starting point
- `currentPath`: array of node IDs from root to current position

### State Management

**Zustand Store:**
- Chosen for lightweight, TypeScript-friendly state management
- Perfect for tree operations and prototype scope
- Single store containing:
  - `tree`: ConversationTree instance
  - `currentPath`: array of node IDs from root to current position
  - `selectedNodeId`: currently selected node for preview
  - `uiState`: tree visualization state (pan/zoom position)
- Actions for tree operations: addNode, deleteNode, setCurrentPath, etc.
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
- each node represents user-assistant exchange (two halves: user top, assistant bottom)
- assistant half shows loading state until response received
- branching only allowed after complete exchanges (assistant responses)
- selected node determines conversation context - chat displays root → selected node  
- active branch highlighting shows same path as chat (root → selected node)
- inactive branches at /50 opacity, hover to /100 opacity
- nodes show truncated content preview or summary for both halves
- + badge below selected node (visual indicator that new messages branch from here)


### Interaction Design
- **Node preview**: Hover or click to preview node content
- **Context switching**: Expand action reconstructs conversation path and updates chat panel
- **Core operations**: Add child nodes, delete nodes
- **Future enhancements**: Merge branches, node compacting

### Tech Stack
- frontend: react (typescript), tailwind, shadcn, zustand, react flow
- build tools: vite
- package manager: npm
- runtime: node.js 20.x LTS
- backend: python 3.11, fastapi
- LLM API: OpenAI GPT-4o mini
- storage: in-memory (no persistence)
- structure: monorepo with separate frontend/ and backend/ folders
- dev ports: frontend 5173, backend 8000

### API Endpoints

**Conversation Management:**
- `GET /api/conversations/{id}` - Get full conversation tree
- `POST /api/conversations` - Create new conversation  
- `DELETE /api/conversations/{id}` - Delete conversation

**Node Operations:**
- `POST /api/nodes` - Create new node (with parentId)
- `GET /api/nodes/{id}` - Get single node
- `DELETE /api/nodes/{id}` - Delete node + children
- `GET /api/paths/{nodeId}` - Get path from root to node

**LLM Interaction:**
- `POST /api/chat` - Send message to LLM, create response node