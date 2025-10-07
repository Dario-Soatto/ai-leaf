'use client';

import { useState, useEffect } from 'react';
import { useAIEditor } from '@/hooks/useAIEditor';
import { useMorphEditor } from '@/hooks/useMorphEditor';
import { usePDFCompiler } from '@/hooks/usePDFCompiler';
import { usePanelResize } from '@/hooks/usePanelResize';
import MorphProposalPanel from './MorphProposalPanel';
import MonacoLaTeXEditor from './MonacoLaTeXEditor';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // ⭐ Add this import
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

type EditingMode = 'complete' | 'morph';

const DEFAULT_LATEX = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{amsfonts}

\\begin{document}

\\title{Demo LaTeX Document}
\\author{Guest User}
\\date{\\today}
\\maketitle

\\section{Introduction}
Welcome to the AI LaTeX Editor demo! Try editing this document or ask the AI for help.

\\section{Mathematics}
Here's a simple equation:
\\begin{equation}
E = mc^2
\\end{equation}

\\end{document}`;

export default function GuestLaTeXEditor() {
  const [latexCode, setLatexCode] = useState(DEFAULT_LATEX);
  const [editingMode, setEditingMode] = useState<EditingMode>('morph');

  // Use custom hooks
  const pdfCompiler = usePDFCompiler();
  const panelResize = usePanelResize();
  
  const aiEditor = useAIEditor(latexCode, setLatexCode, pdfCompiler.setPdfUrl, pdfCompiler.setCompileError, pdfCompiler.compileLatex);
  const morphEditor = useMorphEditor(latexCode, setLatexCode, pdfCompiler.setPdfUrl, pdfCompiler.setCompileError, pdfCompiler.compileLatex);

  // Auto-compile on mount
  useEffect(() => {
    pdfCompiler.compileLatex(latexCode);
  }, []);

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

  // Keyboard shortcut for compile (Cmd/Ctrl + Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        pdfCompiler.compileLatex(latexCode);
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [latexCode, pdfCompiler]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">
            AI LaTeX Editor - Demo
          </h1>
          <Badge variant="secondary" className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">
            Demo Mode - Changes won&apos;t be saved
          </Badge>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Editing Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Mode:</span>
            <div className="flex gap-1">
              <Button
                onClick={() => setEditingMode('complete')}
                variant={editingMode === 'complete' ? 'default' : 'ghost'}
                size="sm"
              >
                Complete Rewrite
              </Button>
              <Button
                onClick={() => setEditingMode('morph')}
                variant={editingMode === 'morph' ? 'default' : 'ghost'}
                size="sm"
              >
                Morph Diff
              </Button>
            </div>
          </div>
          
          <Button asChild>
            <Link href="/login">
              Sign Up to Save
            </Link>
          </Button>
        </div>
      </header>

      {/* Three Panel Layout */}
      <div ref={panelResize.containerRef} className="flex-1 flex overflow-hidden">
        {/* Left Panel - LaTeX Code Editor */}
        <div 
          className="border-r flex flex-col"
          style={{ width: `${panelResize.leftPanelWidth}%` }}
        >
          <div className="bg-muted/50 px-4 py-2 border-b flex items-center justify-between h-10">
            <h2 className="text-sm font-medium">
              LaTeX Code
            </h2>
          </div>
          <div className="flex-1 min-h-0">
            <MonacoLaTeXEditor
              value={latexCode}
              onChange={setLatexCode}
              proposedChanges={editingMode === 'morph' ? morphEditor.proposedChanges : []}
              onApplyChange={morphEditor.applyChange}
              onRejectChange={morphEditor.rejectChange}
              readOnly={false}
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
              onClick={() => pdfCompiler.compileLatex(latexCode)}
              disabled={pdfCompiler.isCompiling}
              size="sm"
              title="⌘+Enter or Ctrl+Enter"
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
              <div className="p-4 border-t">
                <form onSubmit={handleChatSubmit} className="flex gap-2">
                  <Textarea
                    name="message"
                    placeholder="Ask me to help with your LaTeX..."
                    disabled={aiEditor.isAIProcessing}
                    className="resize-none max-h-32"
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
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          ) : (
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
              <div className="p-4 border-t">
                <form onSubmit={handleChatSubmit} className="flex gap-2">
                  <Textarea
                    name="message"
                    placeholder="Ask me to help with your LaTeX..."
                    disabled={morphEditor.isProcessing}
                    className="resize-none max-h-32"
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
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    Send
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