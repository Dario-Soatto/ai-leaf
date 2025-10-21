'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAIEditor } from '@/hooks/useAIEditor';
import { useMorphEditor } from '@/hooks/useMorphEditor';
import { usePDFCompiler } from '@/hooks/usePDFCompiler';
import { usePanelResize } from '@/hooks/usePanelResize';
import MorphProposalPanel from './MorphProposalPanel';
import MonacoLaTeXEditor from './MonacoLaTeXEditor';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // ⭐ Add this import
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

type EditingMode = 'complete' | 'morph';

interface Version {
  id: string;
  latex_content: string;
  trigger_type: string;
  created_at: string;
}

interface Document {
  id: string;
  title: string;
  current_latex: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface LaTeXEditorProps {
  document: Document;
}

export default function LaTeXEditor({ document }: LaTeXEditorProps) {
  const [latexCode, setLatexCode] = useState(document.current_latex);
  const [currentLatexContent, setCurrentLatexContent] = useState(document.current_latex);
  const [editingMode, setEditingMode] = useState<EditingMode>('morph');
  const [isSaving, setIsSaving] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [isViewingVersion, setIsViewingVersion] = useState(false);
  const [title, setTitle] = useState(document.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ⭐ ADD SHARED UNDO/REDO STATE
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const MAX_HISTORY = 20;

  const supabase = useMemo(() => createClient(), []);

  // ⭐ ADD THIS FUNCTION
  const saveToUndoStack = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-MAX_HISTORY + 1), latexCode]);
    setRedoStack([]); // Clear redo stack when new edit is applied
  }, [latexCode]);

  // Use custom hooks
  const pdfCompiler = usePDFCompiler();
  const panelResize = usePanelResize();
  
  // ⭐ UPDATE THESE LINES TO ADD saveToUndoStack PARAMETER
  // Use the appropriate editor hook based on mode
  const aiEditor = useAIEditor(
    latexCode, 
    setLatexCode, 
    pdfCompiler.setPdfUrl, 
    pdfCompiler.setCompileError, 
    pdfCompiler.compileLatex,
    saveToUndoStack
  );
  const morphEditor = useMorphEditor(
    latexCode, 
    setLatexCode, 
    pdfCompiler.setPdfUrl, 
    pdfCompiler.setCompileError, 
    pdfCompiler.compileLatex,
    saveToUndoStack
  );

  // Auto-compile on mount
  useEffect(() => {
    pdfCompiler.compileLatex(latexCode);
  }, []); // Empty dependency array = run once on mount

  // Fetch versions on mount
  useEffect(() => {
    const fetchVersions = async () => {
      const { data, error } = await supabase
        .from('versions')
        .select('*')
        .eq('document_id', document.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching versions:', error);
      } else {
        setVersions(data || []);
      }
    };
    
    fetchVersions();
  }, [document.id, supabase]);

  // Auto-save functionality
  useEffect(() => {
    // Don't auto-save if viewing an old version
    if (isViewingVersion) return;

    // Update the current content tracker
    setCurrentLatexContent(latexCode);

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set a new timeout to save after 2 seconds of no changes
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      
      try {
        await supabase
          .from('documents')
          .update({ 
            current_latex: latexCode,
            updated_at: new Date().toISOString()
          })
          .eq('id', document.id);
      } catch (error) {
        console.error('Error saving document:', error);
      } finally {
        setIsSaving(false);
      }
    }, 2000);

    // Cleanup on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [latexCode, document.id, supabase, isViewingVersion]);

  // Function to save a version
  const saveVersion = async () => {
    try {
      const { data } = await supabase
        .from('versions')
        .insert({
          document_id: document.id,
          user_id: document.user_id,
          latex_content: latexCode,
          trigger_type: 'manual_compile'
        })
        .select()
        .single();
      
      // Add new version to the list
      if (data) {
        setVersions(prev => [data, ...prev]);
      }
      
      console.log('Version saved successfully');
    } catch (error) {
      console.error('Error saving version:', error);
    }
  };

  // Handle compile with version saving
  const handleCompile = async () => {
    await pdfCompiler.compileLatex(latexCode);
    
    // Save version after successful compilation
    if (!pdfCompiler.compileError) {
      await saveVersion();
    }
  };

  // Handle version selection
  const handleVersionSelect = (versionId: string) => {
    if (versionId === 'current') {
      setSelectedVersion(null);
      setIsViewingVersion(false);
      setLatexCode(currentLatexContent);  // ← Use the tracked current content instead!
    } else {
      const version = versions.find(v => v.id === versionId);
      if (version) {
        setSelectedVersion(version);
        setIsViewingVersion(true);
        setLatexCode(version.latex_content);
      }
    }
  };

  // Restore a version as current
  const handleRestoreVersion = async () => {
    if (!selectedVersion) return;
    
    setIsViewingVersion(false);
    setSelectedVersion(null);
    setCurrentLatexContent(selectedVersion.latex_content);  // ← Also update the tracker
    // latexCode is already set to the version content, auto-save will handle the rest
  };

  const handleChatSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const message = formData.get('message') as string;
    
    if (message.trim()) {
      if (editingMode === 'complete') {
        aiEditor.handleAIEdit(message.trim());
      } else {
        morphEditor.handleAIEdit(message.trim());
      }
      e.currentTarget.reset();
    }
  };

  // Save title to database
  const saveTitle = async (newTitle: string) => {
    if (!newTitle.trim()) {
      setTitle(document.title); // Revert if empty
      return;
    }
    
    try {
      await supabase
        .from('documents')
        .update({ title: newTitle.trim() })
        .eq('id', document.id);
      
      setTitle(newTitle.trim());
    } catch (error) {
      console.error('Error saving title:', error);
      setTitle(document.title); // Revert on error
    }
  };

  // Handle title edit completion
  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (title !== document.title) {
      saveTitle(title);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setTitle(document.title);
      setIsEditingTitle(false);
    }
  };

  // Keyboard shortcut for compile (Cmd/Ctrl + Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleCompile();
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [latexCode, pdfCompiler.compileError]); // Dependencies: rerun when these change

  // ⭐ ADD THESE UNDO/REDO FUNCTIONS
  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    
    const previousState = undoStack[undoStack.length - 1];
    setRedoStack(prev => [latexCode, ...prev.slice(0, MAX_HISTORY - 1)]);
    setUndoStack(prev => prev.slice(0, -1));
    setLatexCode(previousState);
  }, [undoStack, latexCode]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    
    const nextState = redoStack[0];
    setUndoStack(prev => [...prev.slice(-MAX_HISTORY + 1), latexCode]);
    setRedoStack(prev => prev.slice(1));
    setLatexCode(nextState);
  }, [redoStack, latexCode]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/documents">
              ← Back
            </Link>
          </Button>
          
          {/* Editable Title */}
          {isEditingTitle ? (
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleTitleKeyDown}
              autoFocus
              className="w-64"
            />
          ) : (
            <h1 
              onClick={() => setIsEditingTitle(true)}
              className="text-xl font-semibold cursor-pointer hover:text-primary transition-colors"
              title="Click to edit"
            >
              {title}
            </h1>
          )}
          
          {isSaving && (
            <span className="text-sm text-muted-foreground">
              Saving...
            </span>
          )}
          
          {/* Version History Select */}
          <div className="flex items-center gap-2">
            <Select
              value={selectedVersion?.id || 'current'}
              onValueChange={handleVersionSelect}
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current Version</SelectItem>
                {versions.map((version) => (
                  <SelectItem key={version.id} value={version.id}>
                    {new Date(version.created_at).toLocaleString()} ({version.trigger_type === 'manual_compile' ? 'Compiled' : 'AI Edit'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {isViewingVersion && (
              <Button
                onClick={handleRestoreVersion}
                size="sm"
                variant="default"
              >
                Restore This Version
              </Button>
            )}
          </div>
          
          {/* ⭐ UPDATE THIS SECTION - Show for both Complete and Morph modes */}
          {!isViewingVersion && (
            <div className="flex items-center gap-1 border-l pl-4 ml-2">
              {editingMode === 'complete' ? (
                <>
                  <Button
                    onClick={undo}
                    disabled={undoStack.length === 0}
                    size="sm"
                    variant="ghost"
                    title="Undo AI Edit (Cmd+Z)"
                  >
                    ↶ Undo
                  </Button>
                  <Button
                    onClick={redo}
                    disabled={redoStack.length === 0}
                    size="sm"
                    variant="ghost"
                    title="Redo AI Edit (Cmd+Shift+Z)"
                  >
                    ↷ Redo
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={undo}
                    disabled={undoStack.length === 0}
                    size="sm"
                    variant="ghost"
                    title="Undo Morph Edit (Cmd+Z)"
                  >
                    ↶ Undo
                  </Button>
                  <Button
                    onClick={redo}
                    disabled={redoStack.length === 0}
                    size="sm"
                    variant="ghost"
                    title="Redo Morph Edit (Cmd+Shift+Z)"
                  >
                    ↷ Redo
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Editing Mode Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Mode:</span>
          <div className="flex gap-1">
            <Button
              onClick={() => setEditingMode('complete')}
              disabled={isViewingVersion}
              variant={editingMode === 'complete' ? 'default' : 'ghost'}
              size="sm"
            >
              Complete Rewrite
            </Button>
            <Button
              onClick={() => setEditingMode('morph')}
              disabled={isViewingVersion}
              variant={editingMode === 'morph' ? 'default' : 'ghost'}
              size="sm"
            >
              Diff Editing
            </Button>
          </div>
        </div>
      </header>

      {/* Version viewing banner */}
      {isViewingVersion && (
        <Alert className="rounded-none border-x-0 border-t-0">
          <AlertDescription>
            📜 Viewing historical version from {selectedVersion && new Date(selectedVersion.created_at).toLocaleString()}. Click &quot;Restore This Version&quot; to make it current.
          </AlertDescription>
        </Alert>
      )}

      {/* Three Panel Layout */}
      <div ref={panelResize.containerRef} className="flex-1 flex overflow-hidden">
        {/* Left Panel - LaTeX Code Editor */}
        <div 
          className="border-r flex flex-col"
          style={{ width: `${panelResize.leftPanelWidth}%` }}
        >
          <div className="bg-muted/50 px-4 py-2 border-b flex items-center justify-between h-10">
            <h2 className="text-sm font-medium">
              LaTeX Code {isViewingVersion && '(Read-Only)'}
            </h2>
          </div>
          <div className="flex-1 min-h-0">
            <MonacoLaTeXEditor
              value={latexCode}
              onChange={setLatexCode}
              proposedChanges={editingMode === 'morph' ? morphEditor.proposedChanges : []}
              onApplyChange={morphEditor.applyChange}
              onRejectChange={morphEditor.rejectChange}
              readOnly={isViewingVersion}
            />
          </div>
        </div>

        {/* Left Resize Handle */}
        <div
          ref={panelResize.leftResizeRef}
          className="w-1 bg-border hover:bg-primary/50 cursor-col-resize transition-colors"
          onMouseDown={(e) => panelResize.handleMouseDown(e, 'left')}
        />

        {/* Middle Panel - PDF Preview */}
        <div 
          className="border-r flex flex-col"
          style={{ width: `${panelResize.middlePanelWidth}%` }}
        >
          <div className="bg-muted/50 px-4 py-2 border-b flex items-center justify-between h-10">
            <h2 className="text-sm font-medium">PDF Preview</h2>
            <Button
              onClick={handleCompile}
              disabled={pdfCompiler.isCompiling}
              size="sm"
            >
              {pdfCompiler.isCompiling ? 'Compiling...' : 'Compile'}
            </Button>
          </div>
          <div className="flex-1 overflow-hidden relative">
            {panelResize.isResizing && (
              <div className="absolute inset-0 z-50" />
            )}
            
            {pdfCompiler.isCompiling && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Compiling LaTeX...</p>
                </div>
              </div>
            )}

            {pdfCompiler.compileError && (
              <div className="p-4 h-full flex items-center justify-center">
                <Alert variant="destructive" className="max-w-md">
                  <AlertDescription>
                    <h3 className="font-medium mb-2">Compilation Error</h3>
                    <p className="text-sm">{pdfCompiler.compileError}</p>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {pdfCompiler.pdfUrl && !pdfCompiler.isCompiling && (
              <iframe
                src={pdfCompiler.pdfUrl}
                className="w-full h-full border-0"
                title="LaTeX PDF Preview"
              />
            )}

            {!pdfCompiler.pdfUrl && !pdfCompiler.isCompiling && !pdfCompiler.compileError && (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">
                  Click &quot;Compile&quot; to generate PDF preview
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Resize Handle */}
        <div
          ref={panelResize.rightResizeRef}
          className="w-1 bg-border hover:bg-primary/50 cursor-col-resize transition-colors"
          onMouseDown={(e) => panelResize.handleMouseDown(e, 'right')}
        />

        {/* Right Panel - AI Chat */}
        <div 
          className="flex flex-col overflow-hidden"
          style={{ width: `${panelResize.rightPanelWidth}%` }}
        >
          <div className="bg-muted/50 px-4 py-2 border-b flex items-center justify-between h-10">
            <h2 className="text-sm font-medium">
              AI Assistant ({editingMode === 'complete' ? 'Complete Rewrite' : 'Morph Diff'})
            </h2>
          </div>
          
          {/* Chat Panel Content */}
          {editingMode === 'complete' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Chat Messages */}
              <div className="flex-1 p-4 overflow-auto">
                <div className="space-y-3">
                  {aiEditor.chatMessages.map((message, index) => (
                    <div key={message.id}>
                      {message.type === 'user' ? (
                        <div className="p-3 rounded-lg bg-primary text-primary-foreground ml-8">
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      ) : (
                        <div>
                          {/* Show loading indicator at the top if processing */}
                          {(() => {
                            const isLastMessage = index === aiEditor.chatMessages.length - 1;
                            const showLoading = aiEditor.isAIProcessing && isLastMessage;
                            
                            return (
                              <>
                                {showLoading && (
                                  <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                    <span className="font-medium">Generating...</span>
                                  </div>
                                )}
                                
                                {/* ⭐ JUST SHOW THE MESSAGE - NO LATEX CODE PARSING */}
                                <p className="text-sm whitespace-pre-wrap mb-3">{message.content}</p>
                                
                                {/* ⭐ SHOW PROPOSAL INLINE - streams live */}
                                {isLastMessage && aiEditor.aiProposal && (
                                  <div className={`border rounded-lg p-3 mt-3 ${
                                    aiEditor.aiProposal.isApplied 
                                      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                                      : aiEditor.aiProposal.isRejected
                                      ? 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20'
                                      : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                                  }`}>
                                    {/* Description and Confidence */}
                                    <div className="mb-2">
                                      <h4 className={`text-sm font-medium mb-1 ${
                                        aiEditor.aiProposal.isApplied
                                          ? 'text-green-800 dark:text-green-200'
                                          : aiEditor.aiProposal.isRejected
                                          ? 'text-gray-600 dark:text-gray-400'
                                          : 'text-blue-800 dark:text-blue-200'
                                      }`}>
                                        {aiEditor.aiProposal.isApplied 
                                          ? '✓ Applied Complete Rewrite' 
                                          : aiEditor.aiProposal.isRejected
                                          ? '✗ Rejected Complete Rewrite'
                                          : 'Proposed Complete Rewrite'}
                                      </h4>
                                      {aiEditor.aiProposal.confidence !== undefined && aiEditor.aiProposal.confidence > 0 && (
                                        <div className={`text-xs ${
                                          aiEditor.aiProposal.isApplied
                                            ? 'text-green-600 dark:text-green-400'
                                            : aiEditor.aiProposal.isRejected
                                            ? 'text-gray-500 dark:text-gray-500'
                                            : 'text-blue-600 dark:text-blue-400'
                                        }`}>
                                          Confidence: {Math.round(aiEditor.aiProposal.confidence * 100)}%
                                        </div>
                                      )}
                                    </div>

                                    {/* LaTeX Code Preview - STREAMS HERE */}
                                    {aiEditor.aiProposal.newLatexCode && (
                                      <div className="mb-3">
                                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                          {aiEditor.isAIProcessing ? 'Streaming preview...' : 'Preview:'}
                                        </div>
                                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-xs font-mono text-gray-800 dark:text-gray-200 max-h-48 overflow-y-auto">
                                          <pre className="whitespace-pre-wrap">{aiEditor.aiProposal.newLatexCode}</pre>
                                        </div>
                                      </div>
                                    )}

                                    {/* Action Buttons - only when streaming is done AND not applied/rejected */}
                                    {!aiEditor.isAIProcessing && !aiEditor.aiProposal.isApplied && !aiEditor.aiProposal.isRejected && (
                                      <div className="flex gap-2">
                                        <button
                                          onClick={aiEditor.acceptAIProposal}
                                          disabled={aiEditor.isApplying}
                                          className="px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors"
                                        >
                                          {aiEditor.isApplying ? 'Applying...' : 'Apply'}
                                        </button>
                                        <button
                                          onClick={aiEditor.rejectAIProposal}
                                          disabled={aiEditor.isApplying}
                                          className="px-3 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors"
                                        >
                                          Reject
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          <p className="text-xs opacity-70 mt-1">
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Show loading indicator after all messages if processing and no assistant message yet */}
                  {aiEditor.isAIProcessing && 
                   (aiEditor.chatMessages.length === 0 || 
                    aiEditor.chatMessages[aiEditor.chatMessages.length - 1]?.type === 'user') && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      <span className="font-medium">Generating...</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Chat Input */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                <form onSubmit={handleChatSubmit} className="relative">
                  <textarea
                    name="message"
                    placeholder="Ask me to help with your LaTeX..."
                    disabled={aiEditor.isAIProcessing}
                    rows={3}
                    className="w-full px-3 py-2 pr-12 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        e.currentTarget.form?.requestSubmit();
                      }
                    }}
                  />
                  <button 
                    type="submit"
                    disabled={aiEditor.isAIProcessing}
                    className="absolute bottom-3 right-2.5 w-8 h-8 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    title="Send message (Enter)"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      className="w-4 h-4"
                    >
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* Morph Mode */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Chat Messages */}
              <div className="flex-1 p-4 overflow-auto">
                <div className="space-y-3">
                  {morphEditor.chatMessages.map((message, index) => (
                    <div key={message.id}>
                      {message.type === 'user' ? (
                        <div className="p-3 rounded-lg bg-primary text-primary-foreground ml-8">
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      ) : (
                        <div>
                          {/* Show loading indicator at the top if processing */}
                          {morphEditor.isProcessing && index === morphEditor.chatMessages.length - 1 && (
                            <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                              <span className="font-medium">Generating...</span>
                            </div>
                          )}
                          
                          <p className="text-sm whitespace-pre-wrap mb-3">{message.content}</p>
                          
                          {/* Show proposed changes for the last assistant message */}
                          {index === morphEditor.chatMessages.length - 1 && 
                           morphEditor.proposedChanges.length > 0 && (
                            <div className="space-y-3 mt-3">
                              {morphEditor.proposedChanges.map((change) => (
                                <div key={change.id} className={`border rounded-lg p-3 ${
                                  change.isApplied
                                    ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                                    : change.isRejected
                                    ? 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20'
                                    : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                                }`}>
                                  {/* Change Description */}
                                  {change.description && (
                                    <div className="mb-2">
                                      <h4 className={`text-sm font-medium mb-1 ${
                                        change.isApplied
                                          ? 'text-green-800 dark:text-green-200'
                                          : change.isRejected
                                          ? 'text-gray-600 dark:text-gray-400'
                                          : 'text-blue-800 dark:text-blue-200'
                                      }`}>
                                        {change.isApplied ? '✓ ' : change.isRejected ? '✗ ' : ''}{change.description}
                                      </h4>
                                      {change.confidence !== undefined && (
                                        <div className={`text-xs ${
                                          change.isApplied
                                            ? 'text-green-600 dark:text-green-400'
                                            : change.isRejected
                                            ? 'text-gray-500 dark:text-gray-500'
                                            : 'text-blue-600 dark:text-blue-400'
                                        }`}>
                                          Confidence: {Math.round(change.confidence * 100)}%
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Code Preview */}
                                  {change.codeEdit && (
                                    <div className="mb-3">
                                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Preview:</div>
                                      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-xs font-mono text-gray-800 dark:text-gray-200">
                                        <pre className="whitespace-pre-wrap">{change.codeEdit}</pre>
                                      </div>
                                    </div>
                                  )}

                                  {/* Action Buttons - only show when streaming is done AND not applied/rejected */}
                                  {!morphEditor.isProcessing && !change.isApplied && !change.isRejected && change.description && change.codeEdit && (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => morphEditor.applyChange(change.id)}
                                        disabled={morphEditor.applyingChangeId === change.id || (morphEditor.applyingChangeId !== null && morphEditor.applyingChangeId !== change.id)}
                                        className="px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors"
                                      >
                                        {morphEditor.applyingChangeId === change.id ? 'Applying...' : 'Apply'}
                                      </button>
                                      <button
                                        onClick={() => morphEditor.rejectChange(change.id)}
                                        disabled={morphEditor.applyingChangeId !== null}
                                        className="px-3 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                              
                              {/* Apply All / Reject All buttons - only show for pending changes */}
                              {!morphEditor.isProcessing && morphEditor.proposedChanges.filter(c => !c.isApplied && !c.isRejected).length > 1 && (
                                <div className="flex gap-2 pt-2">
                                  <button
                                    onClick={morphEditor.applyAllChanges}
                                    disabled={morphEditor.isApplyingAll || morphEditor.applyingChangeId !== null}
                                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors font-medium"
                                  >
                                    {morphEditor.isApplyingAll ? 'Applying All...' : 'Apply All'}
                                  </button>
                                  <button
                                    onClick={morphEditor.rejectAllChanges}
                                    disabled={morphEditor.isApplyingAll || morphEditor.applyingChangeId !== null}
                                    className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors font-medium"
                                  >
                                    Reject All
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          
                          <p className="text-xs opacity-70 mt-1">
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Show loading indicator after all messages if processing and no assistant message yet */}
                  {morphEditor.isProcessing && 
                   (morphEditor.chatMessages.length === 0 || 
                    morphEditor.chatMessages[morphEditor.chatMessages.length - 1]?.type === 'user') && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      <span className="font-medium">Generating...</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Chat Input */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                <form onSubmit={handleChatSubmit} className="relative">
                  <textarea
                    name="message"
                    placeholder="Ask me to help with your LaTeX..."
                    disabled={morphEditor.isProcessing}
                    rows={3}
                    className="w-full px-3 py-2 pr-12 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        e.currentTarget.form?.requestSubmit();
                      }
                    }}
                  />
                  <button 
                    type="submit"
                    disabled={morphEditor.isProcessing}
                    className="absolute bottom-3 right-2.5 w-8 h-8 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    title="Send message (Enter)"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      className="w-4 h-4"
                    >
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}