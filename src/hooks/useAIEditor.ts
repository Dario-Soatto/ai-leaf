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
  isApplied?: boolean;
  isRejected?: boolean;  // ⭐ ADD THIS
}

export function useAIEditor(
  latexCode: string, 
  setLatexCode: (code: string) => void, 
  setPdfUrl: (url: string | null) => void, 
  setCompileError: (error: string | null) => void,
  compileLatex: (code: string) => Promise<void>,
  saveToUndoStack: () => void,
  availableImages?: string[]  // Add this parameter
) {
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  // ⭐ CHANGE: Store proposals per message ID
  const [aiProposals, setAIProposals] = useState<Record<string, AIProposal>>({});
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
      console.log('[Frontend] Starting fetch to /api/ai/edit');
      
      // Prepare chat history (only user messages and AI summaries, no code)
      const chatHistoryForContext = chatMessages.map(msg => ({
        type: msg.type,
        content: msg.content  // This is just the summary/message, not the code
      }));

      
      
      const response = await fetch('/api/ai/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentLatex: latexCode, 
          userRequest,
          chatHistory: chatHistoryForContext,
          availableImages: availableImages || []  // Add this
        }),
      });

      console.log('[Frontend] Response received:', {
        ok: response.ok,
        status: response.status,
        contentType: response.headers.get('Content-Type')
      });

      if (!response.ok) throw new Error('AI request failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) throw new Error('No response body');

      console.log('[Frontend] Starting to read stream...');

      const assistantMessageId = (Date.now() + 1).toString();
      const initialAiMessage: ChatMessage = {
        id: assistantMessageId,
        type: 'assistant',
        content: 'Thinking...',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, initialAiMessage]);

      let accumulatedText = '';
      let latestPartial: Partial<AIProposal> = {};
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('[Frontend] Stream done');
          break;
        }
        
        const decoded = decoder.decode(value, { stream: true });
        
        // Accumulate the raw text
        accumulatedText += decoded;
        buffer += decoded;
        
        // Process complete lines (separated by \n)
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const partialObject: Partial<AIProposal> = JSON.parse(line);
            latestPartial = partialObject;
            
            // ⭐ UPDATE: Only show the MESSAGE in chat (no LaTeX code)
            if (partialObject.message) {
              setChatMessages(prev => 
                prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: partialObject.message || 'Thinking...' }
                    : msg
                )
              );
              
              // CRITICAL: Force React to flush and re-render after EACH line
              await new Promise(resolve => requestAnimationFrame(resolve));
            }
            
            // Update the proposal panel with streaming LaTeX code
            if (partialObject.message || partialObject.newLatexCode) {
              // ⭐ Save proposal with message ID
              setAIProposals(prev => ({
                ...prev,
                [assistantMessageId]: {
                  message: partialObject.message || 'Generating...',
                  newLatexCode: partialObject.newLatexCode || '% Generating LaTeX code...',
                  confidence: partialObject.confidence ?? 0,
                  changes: partialObject.changes ?? []
                }
              }));
            }
          } catch (e) {
            // JSON is incomplete, continue
          }
        }
      }

      console.log('[Frontend] Final state:', {
        hasMessage: !!latestPartial.message,
        hasNewLatexCode: !!latestPartial.newLatexCode
      });

      // Set the final complete result
      if (latestPartial.message && latestPartial.newLatexCode) {
        const finalResult: AIProposal = {
          message: latestPartial.message,
          newLatexCode: latestPartial.newLatexCode,
          confidence: latestPartial.confidence ?? 0,
          changes: latestPartial.changes ?? []
        };
        
        console.log('[Frontend] Setting final result');
        // ⭐ Save with message ID
        setAIProposals(prev => ({
          ...prev,
          [assistantMessageId]: finalResult
        }));
      }

    } catch (error) {
      console.error('[Frontend] AI edit error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsAIProcessing(false);
      console.log('[Frontend] Processing complete');
    }
  }, [latexCode, chatMessages, availableImages]);

  const acceptAIProposal = useCallback(async (messageId: string) => {
    const proposal = aiProposals[messageId];
    if (proposal) {
      setIsApplying(true);
      try {
        // ⭐ CALL THE PARENT'S SAVE FUNCTION
        saveToUndoStack();
        
        setLatexCode(proposal.newLatexCode);
        
        // ⭐ MARK AS APPLIED in the map
        setAIProposals(prev => ({
          ...prev,
          [messageId]: { ...proposal, isApplied: true }
        }));
        
        setCompileError(null);
        setIsApplying(false);
        
        // Compile after accepting (not included in loading state)
        await compileLatex(proposal.newLatexCode);
      } catch (error) {
        setIsApplying(false);
      }
    }
  }, [aiProposals, latexCode, setLatexCode, setPdfUrl, setCompileError, compileLatex, saveToUndoStack]);

  const rejectAIProposal = useCallback((messageId: string) => {
    const proposal = aiProposals[messageId];
    if (proposal) {
      // ⭐ MARK AS REJECTED in the map
      setAIProposals(prev => ({
        ...prev,
        [messageId]: { ...proposal, isRejected: true }
      }));
    }
  }, [aiProposals]);

  return {
    isAIProcessing,
    isApplying,
    aiProposals,  // ⭐ Return the map instead of single proposal
    chatMessages,
    handleAIEdit,
    acceptAIProposal,
    rejectAIProposal,
  };
}
