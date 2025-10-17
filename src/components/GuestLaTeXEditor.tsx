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
                          {(() => {
                            // Show loading indicator at the top if processing
                            const isLastMessage = index === aiEditor.chatMessages.length - 1;
                            const showLoading = aiEditor.isAIProcessing && isLastMessage;
                            
                            // Check if message contains LaTeX code
                            const separator = '\n\n--- LaTeX Code ---\n\n';
                            const parts = message.content.split(separator);
                            
                            return (
                              <>
                                {showLoading && (
                                  <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                    <span className="font-medium">Generating...</span>
                                  </div>
                                )}
                                
                                {parts.length === 2 ? (
                                  // Has both message and LaTeX code
                                  <>
                                    <p className="text-sm whitespace-pre-wrap mb-3">{parts[0]}</p>
                                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-xs font-mono text-gray-800 dark:text-gray-200 mt-2">
                                      <pre className="whitespace-pre-wrap">{parts[1]}</pre>
                                    </div>
                                  </>
                                ) : (
                                  // Just message, no LaTeX code yet
                                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
              
              {/* AI Proposal - only show after streaming is complete */}
              {aiEditor.aiProposal && !aiEditor.isAIProcessing && (
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
                <form onSubmit={handleChatSubmit} className="relative">
                  <textarea
                    name="message"
                    placeholder="Ask me to help with your LaTeX..."
                    disabled={aiEditor.isAIProcessing}
                    rows={3}
                    className="w-full px-3 py-2 pr-12 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-none"
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
                                <div key={change.id} className="border border-blue-200 dark:border-blue-800 rounded-lg p-3 bg-blue-50 dark:bg-blue-900/20">
                                  {/* Change Description */}
                                  {change.description && (
                                    <div className="mb-2">
                                      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                                        {change.description}
                                      </h4>
                                      {change.confidence !== undefined && (
                                        <div className="text-xs text-blue-600 dark:text-blue-400">
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

                                  {/* Action Buttons - only show when streaming is done */}
                                  {!morphEditor.isProcessing && change.description && change.codeEdit && (
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
                              
                              {/* Apply All / Reject All buttons - only when streaming is done */}
                              {!morphEditor.isProcessing && morphEditor.proposedChanges.length > 1 && (
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
              <div className="p-4 border-t">
                <form onSubmit={handleChatSubmit} className="relative">
                  <textarea
                    name="message"
                    placeholder="Ask me to help with your LaTeX..."
                    disabled={morphEditor.isProcessing}
                    rows={3}
                    className="w-full px-3 py-2 pr-12 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-none"
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