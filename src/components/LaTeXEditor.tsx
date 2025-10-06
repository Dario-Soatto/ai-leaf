'use client';

import { useState } from 'react';
import { useAIEditor } from '@/hooks/useAIEditor';
import { useMorphEditor } from '@/hooks/useMorphEditor';
import { usePDFCompiler } from '@/hooks/usePDFCompiler';
import { usePanelResize } from '@/hooks/usePanelResize';
import MorphChatPanel from './MorphChatPanel';
import MorphProposalPanel from './MorphProposalPanel';
import MonacoLaTeXEditor from './MonacoLaTeXEditor';

type EditingMode = 'complete' | 'morph';

export default function LaTeXEditor() {
  const [latexCode, setLatexCode] = useState(`\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{amsfonts}

\\begin{document}

\\title{My First LaTeX Document}
\\author{AI LaTeX Editor}
\\date{\\today}
\\maketitle

\\section{Introduction}
This is a sample LaTeX document created with our AI-powered editor.

\\section{Mathematics}
Here's a simple equation:
\\begin{equation}
E = mc^2
\\end{equation}

And here's an inline equation: $\\int_0^\\infty e^{-x} dx = 1$

\\section{More Math}
Here's a more complex equation:
\\begin{align}
\\frac{d}{dx}[x^n] &= nx^{n-1} \\\\
\\int x^n dx &= \\frac{x^{n+1}}{n+1} + C
\\end{align}

\\section{Lists and Examples}

\\subsection{Numbered Lists}
Here's an example of an enumerated list:

\\begin{enumerate}
\\item First item in the list
\\item Second item with some math: $a^2 + b^2 = c^2$
\\item Third item spanning multiple lines
  with additional text
\\item Fourth item with a complex equation: $\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$
\\end{enumerate}

\\subsection{Bulleted Lists}
Here's an example of an itemized list:

\\begin{itemize}
\\item First bullet point
\\item Second point with inline math: $\\pi \\approx 3.14159$
\\item Third point discussing
  multiple concepts
\\item Fourth point with another equation: $e^{i\\pi} + 1 = 0$
\\end{itemize}

\\section{Conclusion}
This document demonstrates various LaTeX features including mathematics, lists, and document structure.

\\end{document}`);

  const [editingMode, setEditingMode] = useState<EditingMode>('complete');

  // Use custom hooks
  const pdfCompiler = usePDFCompiler();
  const panelResize = usePanelResize();
  
  // Use the appropriate editor hook based on mode
  const aiEditor = useAIEditor(latexCode, setLatexCode, pdfCompiler.setPdfUrl, pdfCompiler.setCompileError);
  const morphEditor = useMorphEditor(latexCode, setLatexCode, pdfCompiler.setPdfUrl, pdfCompiler.setCompileError);

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

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          AI LaTeX Editor
        </h1>
        
        {/* Editing Mode Toggle */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Mode:</span>
          <button
            onClick={() => setEditingMode('complete')}
            className={`px-3 py-1 text-xs rounded-md ${
              editingMode === 'complete'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Complete Rewrite
          </button>
          <button
            onClick={() => setEditingMode('morph')}
            className={`px-3 py-1 text-xs rounded-md ${
              editingMode === 'morph'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Morph Diff
          </button>
        </div>
      </header>

      {/* Three Panel Layout */}
      <div ref={panelResize.containerRef} className="flex-1 flex overflow-hidden">
        {/* Left Panel - LaTeX Code Editor */}
        <div 
          className="border-r border-gray-200 dark:border-gray-700 flex flex-col"
          style={{ width: `${panelResize.leftPanelWidth}%` }}
        >
          <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              LaTeX Code
            </h2>
            <button
              onClick={() => pdfCompiler.compileLatex(latexCode)}
              disabled={pdfCompiler.isCompiling}
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
            >
              {pdfCompiler.isCompiling ? 'Compiling...' : 'Compile'}
            </button>
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
          className="w-1 bg-gray-200 dark:bg-gray-600 hover:bg-blue-400 dark:hover:bg-blue-500 cursor-col-resize transition-colors duration-150 flex items-center justify-center group"
          onMouseDown={(e) => panelResize.handleMouseDown(e, 'left')}
        >
          <div className="w-0.5 h-8 bg-gray-400 dark:bg-gray-500 group-hover:bg-blue-600 dark:group-hover:bg-blue-400 rounded-full"></div>
        </div>

        {/* Middle Panel - LaTeX Renderer */}
        <div 
          className="border-r border-gray-200 dark:border-gray-700 flex flex-col"
          style={{ width: `${panelResize.middlePanelWidth}%` }}
        >
          <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              PDF Preview
            </h2>
          </div>
          <div className="flex-1 overflow-hidden">
            {pdfCompiler.isCompiling && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Compiling LaTeX...</p>
                </div>
              </div>
            )}

            {pdfCompiler.compileError && (
              <div className="p-4 h-full flex items-center justify-center">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 max-w-md">
                  <h3 className="text-red-800 dark:text-red-200 font-medium mb-2">Compilation Error</h3>
                  <p className="text-red-700 dark:text-red-300 text-sm">{pdfCompiler.compileError}</p>
                </div>
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
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <p className="text-sm">Click "Compile" to generate PDF preview</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Resize Handle */}
        <div
          ref={panelResize.rightResizeRef}
          className="w-1 bg-gray-200 dark:bg-gray-600 hover:bg-blue-400 dark:hover:bg-blue-500 cursor-col-resize transition-colors duration-150 flex items-center justify-center group"
          onMouseDown={(e) => panelResize.handleMouseDown(e, 'right')}
        >
          <div className="w-0.5 h-8 bg-gray-400 dark:bg-gray-500 group-hover:bg-blue-600 dark:group-hover:bg-blue-400 rounded-full"></div>
        </div>

        {/* Right Panel - AI Chat */}
        <div 
          className="flex flex-col"
          style={{ width: `${panelResize.rightPanelWidth}%` }}
        >
          <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              AI Assistant ({editingMode === 'complete' ? 'Complete Rewrite' : 'Morph Diff'})
            </h2>
          </div>
          
          {/* Render appropriate chat panel based on mode */}
          {editingMode === 'complete' ? (
            <div className="flex-1 flex flex-col">
              {/* Chat Messages Area */}
              <div className="flex-1 p-4 overflow-auto">
                <div className="space-y-3">
                  {aiEditor.chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-3 rounded-lg ${
                        message.type === 'user'
                          ? 'bg-blue-600 text-white ml-8'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white mr-8'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                  
                  {aiEditor.isAIProcessing && (
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg mr-8">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">AI is thinking...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* AI Proposals */}
              {aiEditor.aiProposal && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <h3 className="text-blue-800 dark:text-blue-200 font-medium mb-2">
                      AI Proposal
                    </h3>
                    <p className="text-blue-700 dark:text-blue-300 text-sm mb-2">
                      {aiEditor.aiProposal.message}
                    </p>
                    <div className="text-xs text-blue-600 dark:text-blue-400 mb-3">
                      Confidence: {Math.round(aiEditor.aiProposal.confidence * 100)}%
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={aiEditor.acceptAIProposal}
                        className="px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700"
                      >
                        Accept
                      </button>
                      <button
                        onClick={aiEditor.rejectAIProposal}
                        className="px-3 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Chat Input */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <form onSubmit={handleChatSubmit} className="flex gap-2">
                  <input
                    name="message"
                    type="text"
                    placeholder="Ask me to help with your LaTeX..."
                    disabled={aiEditor.isAIProcessing}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <button 
                    type="submit"
                    disabled={aiEditor.isAIProcessing}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-50"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* Morph Diff Mode - Chat + Proposal Panel */
            <div className="flex-1 flex flex-col">
              {/* Chat Messages Area */}
              <div className="flex-1 p-4 overflow-auto">
                <div className="space-y-3">
                  {morphEditor.chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-3 rounded-lg ${
                        message.type === 'user'
                          ? 'bg-blue-600 text-white ml-8'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white mr-8'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                  
                  {morphEditor.isProcessing && (
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg mr-8">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">AI is thinking...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Proposed Changes Panel */}
              <MorphProposalPanel
                changes={morphEditor.proposedChanges}
                onApplyChange={morphEditor.applyChange}
                onRejectChange={morphEditor.rejectChange}
                onApplyAll={morphEditor.applyAllChanges}
                onRejectAll={morphEditor.rejectAllChanges}
                isProcessing={morphEditor.isProcessing}
              />
              
              {/* Chat Input */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <form onSubmit={handleChatSubmit} className="flex gap-2">
                  <input
                    name="message"
                    type="text"
                    placeholder="Ask me to help with your LaTeX..."
                    disabled={morphEditor.isProcessing}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <button 
                    type="submit"
                    disabled={morphEditor.isProcessing}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-50"
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