/**
 * Main App component for the chat-tree frontend.
 * 
 * Phase 2: Chat interface implementation
 */
import { useEffect, useState } from 'react';
import { useConversationStore } from './store/conversationStore';
import { apiClient } from './api/client';
import { useTheme } from './hooks/useTheme';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from './components/ui/resizable';
import { Sun, Moon } from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import TreeVisualization from './components/TreeVisualization';
import './App.css';

function App() {
  const [apiStatus, setApiStatus] = useState<string>('Checking...');
  const { currentConversation, isLoading, error, createConversation, clearError } = useConversationStore();
  const { toggleTheme, isDark } = useTheme();

  // Check API health on mount
  useEffect(() => {
    const checkApi = async () => {
      try {
        const health = await apiClient.healthCheck();
        const count = health.storage_stats.total_conversations;
        const conversationLabel = count === 1 ? 'conversation' : 'conversations';
        setApiStatus(`Connected - ${count} ${conversationLabel}`);
      } catch (error) {
        console.error('API health check failed:', error);
        setApiStatus('Backend not available');
      }
    };
    
    checkApi();
  }, []);

  // Auto-create conversation if none exists
  useEffect(() => {
    const autoCreateConversation = async () => {
      if (!currentConversation && !isLoading && apiStatus.includes('Connected')) {
        try {
          await createConversation({ initial_message: null });
        } catch (error) {
          console.error('Failed to auto-create conversation:', error);
        }
      }
    };

    autoCreateConversation();
  }, [currentConversation, isLoading, apiStatus, createConversation]);

  const handleCreateNewConversation = async () => {
    try {
      clearError();
      await createConversation({ initial_message: null });
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Navigation Bar */}
      <header className="flex-shrink-0 bg-card shadow-sm border-b border-border">
        <div className="w-full mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <p className="text-base text-foreground">
                chat-tree
              </p>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">API:</span>
                <Badge variant={apiStatus.includes('Connected') ? 'secondary' : 'destructive'}>
                  {apiStatus}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                onClick={toggleTheme}
                variant="ghost"
                size="sm"
                className="p-2"
                aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                onClick={handleCreateNewConversation}
                disabled={isLoading}
                variant="default"
                size="sm"
              >
                {isLoading ? 'Creating...' : 'New Conversation'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area - Resizable Panels */}
      <ResizablePanelGroup 
        direction="horizontal" 
        className="flex-1 overflow-hidden"
      >
        {/* Tree Visualization Panel */}
        <ResizablePanel 
          defaultSize={30} 
          minSize={20} 
          maxSize={50}
        >
          <TreeVisualization />
        </ResizablePanel>
        
        <ResizableHandle className="w-2 bg-border hover:bg-border/80 transition-colors" />
        
        {/* Chat Panel */}
        <ResizablePanel 
          defaultSize={70} 
          minSize={50}
        >
          <ChatInterface />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Global Error Display */}
      {error && (
        <div className="flex-shrink-0 bg-destructive/10 border-t border-destructive px-4 py-3">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center">
              <div className="text-destructive-foreground text-sm">
                <span className="font-medium">Error:</span> {error}
              </div>
            </div>
            <Button 
              onClick={clearError}
              variant="ghost"
              size="sm"
              className="text-destructive-foreground hover:text-destructive-foreground/80"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
