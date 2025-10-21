import { useState, useCallback } from 'react';
import { 
  MorphEditorState, 
  ProposedChange, 
  ChatMessage, 
  MorphEditRequest,
  MorphApplyRequest,
  MorphEditResponse 
} from '@/lib/morph-types';

export function useMorphEditor(
  latexCode: string, 
  setLatexCode: (code: string) => void, 
  setPdfUrl: (url: string | null) => void, 
  setCompileError: (error: string | null) => void,
  compileLatex: (code: string) => Promise<void> // ⭐ Added compile function
) {
  const [state, setState] = useState<MorphEditorState>({
    isProcessing: false,
    proposedChanges: [],
    chatMessages: [
      {
        id: '1',
        type: 'assistant',
        content: 'Hello! I\'m your AI LaTeX assistant with diff-based editing. I can propose specific changes to your document that you can review and apply individually. What would you like to work on?',
        timestamp: new Date()
      }
    ],
    hasActiveProposal: false,
    currentLatex: latexCode
  });

  const [applyingChangeId, setApplyingChangeId] = useState<string | null>(null);
  const [isApplyingAll, setIsApplyingAll] = useState(false);

  // ⭐ ADD THESE NEW LINES:
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const MAX_HISTORY = 20;

  const handleAIEdit = useCallback(async (userRequest: string) => {
    if (!userRequest.trim()) return;

    setState(prev => ({ ...prev, isProcessing: true }));
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: userRequest,
      timestamp: new Date()
    };
    
    setState(prev => ({
      ...prev,
      chatMessages: [...prev.chatMessages, userMessage]
    }));

    try {
      console.log('[Frontend Morph] Starting fetch to /api/ai/morph-edit');
      
      const response = await fetch('/api/ai/morph-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentLatex: latexCode, 
          userRequest 
        } as MorphEditRequest),
      });

      console.log('[Frontend Morph] Response received:', {
        ok: response.ok,
        status: response.status,
        contentType: response.headers.get('Content-Type')
      });

      if (!response.ok) throw new Error('AI request failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) throw new Error('No response body');

      console.log('[Frontend Morph] Starting to read stream...');

      const assistantMessageId = (Date.now() + 1).toString();
      const initialAiMessage: ChatMessage = {
        id: assistantMessageId,
        type: 'assistant',
        content: 'Thinking...',
        timestamp: new Date()
      };
      setState(prev => ({
        ...prev,
        chatMessages: [...prev.chatMessages, initialAiMessage]
      }));

      let buffer = '';
      let latestPartial: Partial<{ message: string; changes: ProposedChange[]; confidence: number }> = {};

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('[Frontend Morph] Stream done');
          break;
        }
        
        const decoded = decoder.decode(value, { stream: true });
        buffer += decoded;
        
        // Process complete lines (separated by \n)
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const partialObject = JSON.parse(line);
            latestPartial = partialObject;
            
            // Update the AI message with partial content
            if (partialObject.message) {
              setState(prev => ({
                ...prev,
                chatMessages: prev.chatMessages.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: partialObject.message }
                    : msg
                )
              }));
            }
            
            // Update proposed changes as they arrive
            if (partialObject.changes && partialObject.changes.length > 0) {
              setState(prev => ({
                ...prev,
                proposedChanges: partialObject.changes,
                hasActiveProposal: true
              }));
            }
            
            // Force React to flush and re-render after EACH line
            await new Promise(resolve => requestAnimationFrame(resolve));
          } catch (e) {
            // JSON is incomplete, continue
          }
        }
      }

      console.log('[Frontend Morph] Final state:', {
        hasMessage: !!latestPartial.message,
        changeCount: latestPartial.changes?.length || 0
      });

      // Set the final complete result
      if (latestPartial.message && latestPartial.changes) {
        setState(prev => ({
          ...prev,
          proposedChanges: latestPartial.changes || [],
          hasActiveProposal: true,
          chatMessages: prev.chatMessages.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: latestPartial.message || '' }
              : msg
          )
        }));
      }

    } catch (error) {
      console.error('[Frontend Morph] AI edit error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      };
      
      setState(prev => ({
        ...prev,
        chatMessages: [...prev.chatMessages, errorMessage]
      }));
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
      console.log('[Frontend Morph] Processing complete');
    }
  }, [latexCode]);

  const applyChange = useCallback(async (changeId: string) => {
    const change = state.proposedChanges.find(c => c.id === changeId);
    if (!change) return;
    
    setApplyingChangeId(changeId);
    try {
      // ⭐ SAVE CURRENT STATE TO UNDO STACK BEFORE APPLYING
      setUndoStack(prev => [...prev.slice(-MAX_HISTORY + 1), latexCode]);
      setRedoStack([]); // Clear redo stack when new change is applied
      
      const morphRequest: MorphApplyRequest = {
        instruction: change.description,
        originalCode: latexCode,
        codeEdit: change.codeEdit
      };

      const response = await fetch('/api/morph/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(morphRequest),
      });

      if (!response.ok) throw new Error('Morph apply failed');

      const result = await response.json();
      
      setLatexCode(result.mergedCode);
      setCompileError(null);
      
      setState(prev => ({
        ...prev,
        proposedChanges: prev.proposedChanges.filter(c => c.id !== changeId),
        hasActiveProposal: prev.proposedChanges.length > 1
      }));

      setApplyingChangeId(null);
      
      await compileLatex(result.mergedCode);

    } catch (error) {
      console.error('Error applying change:', error);
      setCompileError(`Failed to apply change: ${change.description}`);
      setApplyingChangeId(null);
    }
  }, [state.proposedChanges, latexCode, setLatexCode, setPdfUrl, setCompileError, compileLatex]);

  const rejectChange = useCallback((changeId: string) => {
    setState(prev => ({
      ...prev,
      proposedChanges: prev.proposedChanges.filter(c => c.id !== changeId),
      hasActiveProposal: prev.proposedChanges.length > 1
    }));
  }, []);

  const applyAllChanges = useCallback(async () => {
    setIsApplyingAll(true);
    if (state.proposedChanges.length === 0) return;

    try {
      // ⭐ SAVE CURRENT STATE TO UNDO STACK BEFORE APPLYING ALL
      setUndoStack(prev => [...prev.slice(-MAX_HISTORY + 1), latexCode]);
      setRedoStack([]); // Clear redo stack when new changes are applied
      
      let currentCode = latexCode;
      
      for (const change of state.proposedChanges) {
        const morphRequest: MorphApplyRequest = {
          instruction: change.description,
          originalCode: currentCode,
          codeEdit: change.codeEdit
        };

        const response = await fetch('/api/morph/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(morphRequest),
        });

        if (!response.ok) throw new Error('Morph apply failed');

        const result = await response.json();
        currentCode = result.mergedCode;
      }

      setLatexCode(currentCode);
      setCompileError(null);
      
      setState(prev => ({
        ...prev,
        proposedChanges: [],
        hasActiveProposal: false
      }));

      setIsApplyingAll(false);
      
      await compileLatex(currentCode);

    } catch (error) {
      console.error('Error applying all changes:', error);
      setCompileError('Failed to apply changes. Please try again.');
      setIsApplyingAll(false);
    }
  }, [state.proposedChanges, latexCode, setLatexCode, setPdfUrl, setCompileError, compileLatex]);

  const rejectAllChanges = useCallback(() => {
    setState(prev => ({
      ...prev,
      proposedChanges: [],
      hasActiveProposal: false
    }));
  }, []);

  // ⭐ ADD THESE NEW FUNCTIONS:
  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    
    const previousState = undoStack[undoStack.length - 1];
    setRedoStack(prev => [latexCode, ...prev.slice(0, MAX_HISTORY - 1)]);
    setUndoStack(prev => prev.slice(0, -1));
    setLatexCode(previousState);
  }, [undoStack, latexCode, setLatexCode]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    
    const nextState = redoStack[0];
    setUndoStack(prev => [...prev.slice(-MAX_HISTORY + 1), latexCode]);
    setRedoStack(prev => prev.slice(1));
    setLatexCode(nextState);
  }, [redoStack, latexCode, setLatexCode]);

  return {
    isProcessing: state.isProcessing,
    applyingChangeId,
    isApplyingAll,
    proposedChanges: state.proposedChanges,
    chatMessages: state.chatMessages,
    hasActiveProposal: state.hasActiveProposal,
    
    handleAIEdit,
    applyChange,
    rejectChange,
    applyAllChanges,
    rejectAllChanges,
    // ⭐ ADD THESE:
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
