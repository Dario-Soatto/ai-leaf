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

  const applyChange = useCallback(async (changeId: string) => {
    const change = state.proposedChanges.find(c => c.id === changeId);
    if (!change) return;
    
    setApplyingChangeId(changeId);
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
    rejectAllChanges
  };
}
