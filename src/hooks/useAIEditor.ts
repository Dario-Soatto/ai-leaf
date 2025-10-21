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
  compileLatex: (code: string) => Promise<void>,
  saveToUndoStack: () => void  // ⭐ ADD THIS PARAMETER
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
      console.log('[Frontend] Starting fetch to /api/ai/edit');
      
      const response = await fetch('/api/ai/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentLatex: latexCode, userRequest }),
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
            
            // Build a display that shows BOTH the message and the LaTeX code as they stream
            let displayContent = '';
            
            if (partialObject.message) {
              displayContent += partialObject.message;
            }
            
            if (partialObject.newLatexCode) {
              if (displayContent) displayContent += '\n\n--- LaTeX Code ---\n\n';
              displayContent += partialObject.newLatexCode;
            }
            
            if (displayContent) {
              setChatMessages(prev => 
                prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: displayContent }
                    : msg
                )
              );
              
              // CRITICAL: Force React to flush and re-render after EACH line
              // Use requestAnimationFrame to ensure browser paints before continuing
              await new Promise(resolve => requestAnimationFrame(resolve));
            }
            
            // Also update the proposal panel
            if (partialObject.message || partialObject.newLatexCode) {
              setAIProposal({
                message: partialObject.message || 'Generating...',
                newLatexCode: partialObject.newLatexCode || '% Generating LaTeX code...',
                confidence: partialObject.confidence ?? 0,
                changes: partialObject.changes ?? []
              });
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
        setAIProposal(finalResult);
        
        // Keep the LaTeX code in the chat message after streaming completes
        const finalDisplayContent = finalResult.message + 
          '\n\n--- LaTeX Code ---\n\n' + 
          finalResult.newLatexCode;
        
        setChatMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: finalDisplayContent }
              : msg
          )
        );
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
  }, [latexCode]);

  const acceptAIProposal = useCallback(async () => {
    if (aiProposal) {
      setIsApplying(true);
      try {
        // ⭐ CALL THE PARENT'S SAVE FUNCTION
        saveToUndoStack();
        
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
  }, [aiProposal, latexCode, setLatexCode, setPdfUrl, setCompileError, compileLatex, saveToUndoStack]);

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
    rejectAIProposal,
  };
}
