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
  const [editingMode, setEditingMode] = useState<EditingMode>('complete');
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
  const aiEditor = useAIEditor(latexCode, setLatexCode, pdfCompiler.setPdfUrl, pdfCompiler.setCompileError);
  const morphEditor = useMorphEditor(latexCode, setLatexCode, pdfCompiler.setPdfUrl, pdfCompiler.setCompileError);

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
      setLatexCode(document.current_latex);
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

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href="/documents"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            ← Back
          </Link>
          
          {/* Editable Title */}
          {isEditingTitle ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleTitleKeyDown}
              autoFocus
              className="text-xl font-semibold text-gray-900 dark:text-white bg-transparent border-b-2 border-blue-500 focus:outline-none px-1"
            />
          ) : (
            <h1 
              onClick={() => setIsEditingTitle(true)}
              className="text-xl font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              title="Click to edit"
            >
              {title}
            </h1>
          )}
          
          {isSaving && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Saving...
            </span>
          )}
          
          {/* Version History Dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={selectedVersion?.id || 'current'}
              onChange={(e) => handleVersionSelect(e.target.value)}
              className="px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="current">Current Version</option>
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {new Date(version.created_at).toLocaleString()} ({version.trigger_type === 'manual_compile' ? 'Compiled' : 'AI Edit'})
                </option>
              ))}
            </select>
            
            {isViewingVersion && (
              <button
                onClick={handleRestoreVersion}
                className="px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700"
              >
                Restore This Version
              </button>
            )}
          </div>
        </div>
        
        {/* Editing Mode Toggle */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Mode:</span>
          <button
            onClick={() => setEditingMode('complete')}
            disabled={isViewingVersion}
            className={`px-3 py-1 text-xs rounded-md ${
              editingMode === 'complete'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            } disabled:opacity-50`}
          >
            Complete Rewrite
          </button>
          <button
            onClick={() => setEditingMode('morph')}
            disabled={isViewingVersion}
            className={`px-3 py-1 text-xs rounded-md ${
              editingMode === 'morph'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            } disabled:opacity-50`}
          >
            Morph Diff
          </button>
        </div>
      </header>

      {/* Version viewing banner */}
      {isViewingVersion && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            📜 Viewing historical version from {selectedVersion && new Date(selectedVersion.created_at).toLocaleString()}. Click &quot;Restore This Version&quot; to make it current.
          </p>
        </div>
      )}

      {/* Three Panel Layout */}
      <div ref={panelResize.containerRef} className="flex-1 flex overflow-hidden">
        {/* Left Panel - LaTeX Code Editor */}
        <div 
          className="border-r border-gray-200 dark:border-gray-700 flex flex-col"
          style={{ width: `${panelResize.leftPanelWidth}%` }}
        >
          <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between h-10">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              LaTeX Code {isViewingVersion && '(Read-Only)'}
            </h2>
            <div className="w-16"></div>
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
          <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between h-10">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              PDF Preview
            </h2>
            <button
              onClick={handleCompile}
              disabled={pdfCompiler.isCompiling}
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
            >
              {pdfCompiler.isCompiling ? 'Compiling...' : 'Compile'}
            </button>
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
                  <p className="text-sm">Click &quot;Compile&quot; to generate PDF preview</p>
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
          className="flex flex-col overflow-hidden"
          style={{ width: `${panelResize.rightPanelWidth}%` }}
        >
          <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between h-10">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              AI Assistant ({editingMode === 'complete' ? 'Complete Rewrite' : 'Morph Diff'})
            </h2>
            <div className="w-16"></div>
          </div>
          
          {/* Render appropriate chat panel based on mode */}
          {editingMode === 'complete' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
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
                <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex-shrink-0">
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
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
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
            <div className="flex-1 flex flex-col overflow-hidden">
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
              <div className="flex-shrink-0">
                <MorphProposalPanel
                  changes={morphEditor.proposedChanges}
                  onApplyChange={morphEditor.applyChange}
                  onRejectChange={morphEditor.rejectChange}
                  onApplyAll={morphEditor.applyAllChanges}
                  onRejectAll={morphEditor.rejectAllChanges}
                  isProcessing={morphEditor.isProcessing}
                />
              </div>
              
              {/* Chat Input */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
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