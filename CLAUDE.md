# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chat-tree is an experimental UI for chatting with LLMs that represents conversations as a graph of nodes, allowing for branching and context-building. It's a monorepo with separate frontend and backend services.

**Architecture:**
- Frontend: React + TypeScript + Vite + Tailwind + Zustand
- Backend: Python + FastAPI + OpenAI API
- No persistence (in-memory storage only)
- No authentication (prototype scope)

## Development Commands

### Frontend (React/Vite)
```bash
cd frontend
npm install              # Install dependencies
npm run dev             # Start development server (http://localhost:5173)
npm run build           # Build for production
npm run lint            # Run ESLint
npm run preview         # Preview production build
```

### Backend (FastAPI)
```bash
cd backend
python -m venv venv                    # Create virtual environment
source venv/bin/activate              # Activate virtual environment (macOS/Linux)
pip install -r requirements.txt       # Install dependencies
uvicorn main:app --reload --port 8000 # Start development server
```

## Core Architecture

### Data Model
The application centers around a tree structure where each conversation is represented as a `ConversationTree` containing `ConversationNode` objects:

- **ConversationNode**: Individual messages with `id`, `content`, `summary`, `role` ("user"|"assistant"), `parent_id`, and `children_ids`
- **ConversationTree**: Container with `nodes` map, `root_id`, and `current_path` array
- **Current Path**: Array of node IDs from root to current position, determines what's shown in chat interface

### State Management
Uses Zustand for lightweight state management:
- Single store in `frontend/src/store/conversationStore.ts`
- Actions for CRUD operations on conversations and nodes
- Utility functions for path navigation and tree operations
- Automatic error handling and loading states

### API Architecture
RESTful API with endpoints organized by functionality:
- **Conversations**: Create, read, delete conversation trees
- **Nodes**: Create, read, delete individual nodes within conversations
- **Chat**: Send messages to OpenAI and create response nodes
- **Paths**: Navigate between different conversation branches

Key files:
- `backend/main.py`: FastAPI app with all endpoints
- `backend/models.py`: Pydantic models for request/response schemas
- `backend/storage.py`: In-memory storage implementation
- `backend/openai_service.py`: OpenAI API integration

### Frontend Structure
- `src/components/ChatInterface.tsx`: Main chat view showing current conversation path
- `src/components/TreeVisualization.tsx`: Interactive tree view with pan/zoom
- `src/components/TreeNode.tsx`: Individual node rendering in tree
- `src/api/client.ts`: API client for backend communication
- `src/types/conversation.ts`: TypeScript type definitions

### UI Architecture
Three-panel layout:
1. **Chat Panel**: Linear conversation view of current path
2. **Tree Panel**: Interactive graph showing full conversation structure
3. **Navigation**: Context switching between different conversation branches

Tree visualization features:
- Vertical layout (root at top)
- Pan/zoom with react-zoom-pan-pinch
- Current path highlighting
- Branch opacity changes on hover
- Node content previews

## Development Notes

### Running Both Services
Start backend first on port 8000, then frontend on port 5173. CORS is configured for local development.

### Key Patterns
- Tree operations always work through the Zustand store
- API calls automatically refresh conversation state
- Error boundaries handle API failures gracefully
- Loading states prevent UI inconsistencies during async operations

### OpenAI Integration
Requires `OPENAI_API_KEY` environment variable in backend. Uses GPT-4o mini model by default. Conversation history is sent as array of messages following OpenAI chat format.

### Testing
No test framework currently configured. When adding tests, examine existing project structure to determine appropriate testing approach.