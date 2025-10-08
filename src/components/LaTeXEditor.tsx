'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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

  const supabase = useMemo(() => createClient(), []);

  // Use custom hooks
  const pdfCompiler = usePDFCompiler();
  const panelResize = usePanelResize();
  
  // Use the appropriate editor hook based on mode
  const aiEditor = useAIEditor(latexCode, setLatexCode, pdfCompiler.setPdfUrl, pdfCompiler.setCompileError, pdfCompiler.compileLatex);
  const morphEditor = useMorphEditor(latexCode, setLatexCode, pdfCompiler.setPdfUrl, pdfCompiler.setCompileError, pdfCompiler.compileLatex);

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
                  {aiEditor.chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-3 rounded-lg ${
                        message.type === 'user'
                          ? 'bg-primary text-primary-foreground ml-8'
                          : 'bg-muted mr-8'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                  
                  {aiEditor.isAIProcessing && (
                    <div className="bg-muted p-3 rounded-lg mr-8">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        <p className="text-sm text-muted-foreground">AI is thinking...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* AI Proposal */}
              {aiEditor.aiProposal && (
                <div className="border-t p-4">
                  <Alert>
                    <AlertDescription className="space-y-3">
                      <div>
                        <h3 className="font-medium mb-1">AI Proposal</h3>
                        <p className="text-sm">{aiEditor.aiProposal.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Confidence: {Math.round(aiEditor.aiProposal.confidence * 100)}%
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={aiEditor.acceptAIProposal}
                          disabled={aiEditor.isApplying}
                          size="sm"
                          variant="default"
                        >
                          {aiEditor.isApplying ? 'Applying...' : 'Accept'}
                        </Button>
                        <Button
                          onClick={aiEditor.rejectAIProposal}
                          size="sm"
                          variant="destructive"
                        >
                          Reject
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                </div>
              )}
              
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
                  {morphEditor.chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-3 rounded-lg ${
                        message.type === 'user'
                          ? 'bg-primary text-primary-foreground ml-8'
                          : 'bg-muted mr-8'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                  
                  {morphEditor.isProcessing && (
                    <div className="bg-muted p-3 rounded-lg mr-8">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        <p className="text-sm text-muted-foreground">AI is thinking...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Morph Proposals */}
              <div className="flex-shrink-0">
                <MorphProposalPanel
                  changes={morphEditor.proposedChanges}
                  onApplyChange={morphEditor.applyChange}
                  onRejectChange={morphEditor.rejectChange}
                  onApplyAll={morphEditor.applyAllChanges}
                  onRejectAll={morphEditor.rejectAllChanges}
                  isProcessing={morphEditor.isProcessing}
                  applyingChangeId={morphEditor.applyingChangeId}
                  isApplyingAll={morphEditor.isApplyingAll}
                />
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