import { useState, useCallback } from 'react';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AIProposal {
  message: string;
  newLatexCode: string;
  confidence: number;
  changes: string[];
}

export function useAIEditor(
  latexCode: string, 
  setLatexCode: (code: string) => void, 
  setPdfUrl: (url: string | null) => void, 
  setCompileError: (error: string | null) => void,
  compileLatex: (code: string) => Promise<void>
) {
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [aiProposal, setAIProposal] = useState<AIProposal | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Hello! I\'m your AI LaTeX assistant. I can help you write, edit, and improve your LaTeX documents. What would you like to work on?',
      timestamp: new Date()
    }
  ]);

  const handleAIEdit = useCallback(async (userRequest: string) => {
    if (!userRequest.trim()) return;

    setIsAIProcessing(true);
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: userRequest,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch('/api/ai/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentLatex: latexCode, userRequest }),
      });

      if (!response.ok) throw new Error('AI request failed');

      const result = await response.json();
      setAIProposal(result);
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: result.message,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, aiMessage]);

    } catch (error) {
      console.error('AI edit error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsAIProcessing(false);
    }
  }, [latexCode]);

  const acceptAIProposal = useCallback(async () => {
    if (aiProposal) {
      setIsApplying(true);
      try {
        setLatexCode(aiProposal.newLatexCode);
        setAIProposal(null);
        setCompileError(null);
        
        setIsApplying(false);
        
        // Compile after accepting (not included in loading state)
        await compileLatex(aiProposal.newLatexCode);
      } catch (error) {
        setIsApplying(false);
      }
    }
  }, [aiProposal, setLatexCode, setPdfUrl, setCompileError, compileLatex]);

  const rejectAIProposal = useCallback(() => {
    setAIProposal(null);
  }, []);

  return {
    isAIProcessing,
    isApplying,
    aiProposal,
    chatMessages,
    handleAIEdit,
    acceptAIProposal,
    rejectAIProposal
  };
}
