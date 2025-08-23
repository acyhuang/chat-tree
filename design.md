# chat-tree

## Project Overview
Experimental UI for chatting with LLMs. Represents the conversation as a graph of nodes, allowing for branching and context-building.

**Features:**
- Send messages to and receive messages from LLMs
- Show conversation as a tree of nodes where each node is a message
- Allow creation of leaf nodes (branching) and deletion of nodes
- Allow switching between paths from root to leaf (context)

**Scope:** Polished prototype, not production-ready.
- no user authentication
- no persistence between sessions

## Implementation

### User interface
Three primary components:
- Top navigation bar - help button
- Chat - shows current conversation branch in full, similar to a chat interface
- Tree - shows full conversation tree, with current branch highlighted

### Tech Stack
- frontend: react (typescript), tailwind, shadcn
- build tools: vite
- package manager: npm
- runtime: node.js 20.x LTS
- backend: python 3.11, fastapi
- LLM API: OpenAI GPT-4o mini
- storage: in-memory (no persistence)
- structure: monorepo with separate frontend/ and backend/ folders
- dev ports: frontend 5173, backend 8000