import { useState, useCallback } from 'react';
import { 
  MorphEditorState, 
  ProposedChange, 
  ChatMessage, 
  MorphEditRequest,
  MorphApplyRequest 
} from '@/lib/morph-types';

export function useMorphEditor(
  latexCode: string, 
  setLatexCode: (code: string) => void, 
  setPdfUrl: (url: string | null) => void, 
  setCompileError: (error: string | null) => void
) {
  // Initial state
  const [state, setState] = useState<MorphEditorState>({
    isProcessing: false,
    proposedChanges: [],
    chatMessages: [
      {
        id: '1',
        type: 'assistant',
        content: 'Hello! I\'m your AI LaTeX assistant with Morph-powered editing. I can propose specific changes to your document that you can review and apply individually. What would you like to work on?',
        timestamp: new Date()
      }
    ],
    hasActiveProposal: false,
    currentLatex: latexCode
  });

  // Handle AI edit request - this will call our new API
  const handleAIEdit = useCallback(async (userRequest: string) => {
    if (!userRequest.trim()) return;

    setState(prev => ({ ...prev, isProcessing: true }));
    
    // Add user message to chat
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
      // Call our new Morph API endpoint
      const response = await fetch('/api/ai/morph-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentLatex: latexCode, 
          userRequest 
        } as MorphEditRequest),
      });

      if (!response.ok) throw new Error('AI request failed');

      const result = await response.json();
      
      // Add AI response to chat
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: result.message,
        timestamp: new Date()
      };

      setState(prev => ({
        ...prev,
        proposedChanges: result.changes,
        hasActiveProposal: true,
        chatMessages: [...prev.chatMessages, aiMessage]
      }));

    } catch (error) {
      console.error('Morph AI edit error:', error);
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
    }
  }, [latexCode]);

  // Apply a single change using MorphLLM
  const applyChange = useCallback(async (changeId: string) => {
    const change = state.proposedChanges.find(c => c.id === changeId);
    if (!change) return;

    try {
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
      
      // Update the LaTeX code with the merged result
      setLatexCode(result.mergedCode);
      setPdfUrl(null); // Clear PDF to force recompilation
      setCompileError(null);
      
      // Remove this change from the proposed changes
      setState(prev => ({
        ...prev,
        proposedChanges: prev.proposedChanges.filter(c => c.id !== changeId),
        hasActiveProposal: prev.proposedChanges.length > 1 // Still has proposals if more than 1 left
      }));

    } catch (error) {
      console.error('Error applying change:', error);
      setCompileError(`Failed to apply change: ${change.description}`);
    }
  }, [state.proposedChanges, latexCode, setLatexCode, setPdfUrl, setCompileError]);

  // Reject a single change (just remove it from the list)
  const rejectChange = useCallback((changeId: string) => {
    setState(prev => ({
      ...prev,
      proposedChanges: prev.proposedChanges.filter(c => c.id !== changeId),
      hasActiveProposal: prev.proposedChanges.length > 1 // Still has proposals if more than 1 left
    }));
  }, []);

  // Apply all changes at once
  const applyAllChanges = useCallback(async () => {
    if (state.proposedChanges.length === 0) return;

    try {
      let currentCode = latexCode;
      
      // Apply changes one by one
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

      // Update the LaTeX code with the final merged result
      setLatexCode(currentCode);
      setPdfUrl(null); // Clear PDF to force recompilation
      setCompileError(null);
      
      // Clear all proposals
      setState(prev => ({
        ...prev,
        proposedChanges: [],
        hasActiveProposal: false
      }));

    } catch (error) {
      console.error('Error applying all changes:', error);
      setCompileError('Failed to apply changes. Please try again.');
    }
  }, [state.proposedChanges, latexCode, setLatexCode, setPdfUrl, setCompileError]);

  // Reject all changes
  const rejectAllChanges = useCallback(() => {
    setState(prev => ({
      ...prev,
      proposedChanges: [],
      hasActiveProposal: false
    }));
  }, []);

  return {
    // State
    isProcessing: state.isProcessing,
    proposedChanges: state.proposedChanges,
    chatMessages: state.chatMessages,
    hasActiveProposal: state.hasActiveProposal,
    
    // Actions
    handleAIEdit,
    applyChange,
    rejectChange,
    applyAllChanges,
    rejectAllChanges
  };
}
