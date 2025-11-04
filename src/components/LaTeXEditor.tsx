'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import FileManager from './FileManager';
import { useFileManager, DocumentFile } from '@/hooks/useFileManager';
import { FileText } from 'lucide-react';
import { useAIEditor } from '@/hooks/useAIEditor';
import { useMorphEditor } from '@/hooks/useMorphEditor';
import { usePDFCompiler } from '@/hooks/usePDFCompiler';
import { usePanelResize } from '@/hooks/usePanelResize';
import MonacoLaTeXEditor from './MonacoLaTeXEditor';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import ImageManager from './ImageManager';
import { useImageManager } from '@/hooks/useImageManager';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from 'lucide-react'; // Add this import

type EditingMode = 'complete' | 'morph';

interface FileSnapshot {
  filename: string;
  file_type: string;
  content: string;
  is_main: boolean;
}

interface Version {
  id: string;
  latex_content: string;
  file_snapshots?: FileSnapshot[];
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
  // Multi-file state management
  const fileManager = useFileManager(document.id);
  const [activeFile, setActiveFile] = useState<DocumentFile | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [currentEditorContent, setCurrentEditorContent] = useState('');
  
  // UI state
  const [showFileManager, setShowFileManager] = useState(true);
  const [showImageManager, setShowImageManager] = useState(false);
  const [editingMode, setEditingMode] = useState<EditingMode>('morph');
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparingCompile, setIsPreparingCompile] = useState(false);
  const [title, setTitle] = useState(document.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  
  // Version history state
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [isViewingVersion, setIsViewingVersion] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { images } = useImageManager(document.id);
  const availableImageFilenames = images.map(img => img.filename);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const handleFixError = () => {
    if (!pdfCompiler.compileError) return;
    
    const errorMessage = `The following error occurred while compiling the LaTeX document. Please resolve the error:\n\n${pdfCompiler.compileError}`;
    
    if (chatInputRef.current) {
      chatInputRef.current.value = errorMessage;
      chatInputRef.current.focus();
      // Scroll to bottom of chat input
      chatInputRef.current.scrollTop = chatInputRef.current.scrollHeight;
    }
  };
  

  // Undo/Redo state
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const MAX_HISTORY = 20;

  const supabase = useMemo(() => createClient(), []);

  // Save current content to undo stack
  const saveToUndoStack = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-MAX_HISTORY + 1), editorContent]);
    setRedoStack([]); // Clear redo stack when new edit is applied
  }, [editorContent]);

  // Use custom hooks
  const pdfCompiler = usePDFCompiler(document.id);
  const panelResize = usePanelResize();
  
  // Combined compiling state (includes preparing/saving phase)
  const isCompiling = isPreparingCompile || pdfCompiler.isCompiling;
  
  // Compile with auto-save wrapper (defined before AI hooks need it)
  const compileWithSave = useCallback(async (content?: string) => {
    // Only save if there are actual changes
    if (activeFile && editorContent !== activeFile.content) {
      console.log('💾 Saving before compile (content changed)');
      try {
        await fileManager.updateFile(activeFile.id, editorContent);
        // Update activeFile to reflect the saved content
        setActiveFile(prev => prev ? { ...prev, content: editorContent } : null);
      } catch (error) {
        console.error('Error saving before compile:', error);
        return;
      }
    } else if (activeFile) {
      console.log('⚡ Skipping save - no changes detected');
    }
    
    const mainFile = fileManager.files.find(f => f.is_main);
    if (!mainFile) {
      console.error('No main file found');
      return;
    }

    await pdfCompiler.compileLatex(content || mainFile.content);
  }, [activeFile, editorContent, fileManager, pdfCompiler]);
  
  // AI editing hooks - work with the active file's content
  const aiEditor = useAIEditor(
    editorContent, 
    setEditorContent, 
    pdfCompiler.setPdfUrl, 
    pdfCompiler.setCompileError, 
    compileWithSave,
    saveToUndoStack,
    availableImageFilenames
  );
  const morphEditor = useMorphEditor(
    editorContent, 
    setEditorContent, 
    pdfCompiler.setPdfUrl, 
    pdfCompiler.setCompileError, 
    compileWithSave,
    saveToUndoStack,
    availableImageFilenames
  );

  // Initialize active file when files load
  useEffect(() => {
    if (fileManager.files.length > 0 && !activeFile) {
      const mainFile = fileManager.files.find(f => f.is_main) || fileManager.files[0];
      setActiveFile(mainFile);
      setEditorContent(mainFile.content);
      setCurrentEditorContent(mainFile.content);
    }
  }, [fileManager.files, activeFile]);

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

  // Auto-save active file
  useEffect(() => {
    if (isViewingVersion || !activeFile) return;

    // Skip if content hasn't changed
    if (editorContent === activeFile.content) return;

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set a new timeout to save after 2 seconds of no changes
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      
      try {
        await fileManager.updateFile(activeFile.id, editorContent);
        // Update activeFile to reflect the saved content
        setActiveFile(prev => prev ? { ...prev, content: editorContent } : null);
        console.log('✅ Auto-saved:', activeFile.filename, 'length:', editorContent.length);
      } catch (error) {
        console.error('❌ Save error:', error);
      } finally {
        setIsSaving(false);
      }
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
    // Only trigger on editorContent changes or when switching active file
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorContent, activeFile?.id, isViewingVersion]);

  // Function to save a version (saves all files)
  const saveVersion = async () => {
    try {
      // Fetch FRESH file data from database, not local state
      const response = await fetch(`/api/files/list?documentId=${document.id}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch files');
      }

      const freshFiles = data.files || [];
      const mainFile = freshFiles.find((f: DocumentFile) => f.is_main);
      if (!mainFile) {
        console.error('No main file found when saving version');
        return;
      }

      // Capture all current files as a snapshot from fresh database data
      const fileSnapshots: FileSnapshot[] = freshFiles.map((file: DocumentFile) => ({
        filename: file.filename,
        file_type: file.file_type,
        content: file.content,
        is_main: file.is_main
      }));

      const { data: version } = await supabase
        .from('versions')
        .insert({
          document_id: document.id,
          user_id: document.user_id,
          latex_content: mainFile.content, // For backward compatibility
          file_snapshots: fileSnapshots,
          trigger_type: 'manual_compile'
        })
        .select()
        .single();
      
      // Add new version to the list
      if (version) {
        setVersions(prev => [version, ...prev]);
      }
      
      console.log('✅ Version saved successfully with', fileSnapshots.length, 'files from fresh database data');
    } catch (error) {
      console.error('❌ Error saving version:', error);
    }
  };

  // Handle compile with version saving
  const handleCompile = useCallback(async () => {
    setIsPreparingCompile(true);
    
    try {
      await compileWithSave();
      
      if (!pdfCompiler.compileError) {
        await saveVersion();
      }
    } finally {
      setIsPreparingCompile(false);
    }
  }, [compileWithSave, pdfCompiler.compileError]);

  // Handle version selection
const handleVersionSelect = (versionId: string) => {
  if (versionId === 'current') {
    setSelectedVersion(null);
    setIsViewingVersion(false);
    setEditorContent(currentEditorContent);
    // Restore the active file to current state
    if (activeFile) {
      const currentFile = fileManager.files.find(f => f.id === activeFile.id);
      if (currentFile) {
        setActiveFile(currentFile);
        setEditorContent(currentFile.content);
      }
    }
  } else {
    const version = versions.find(v => v.id === versionId);
    if (version) {
      setSelectedVersion(version);
      setIsViewingVersion(true);
      
      // If we have file snapshots, show the main file from the snapshot
      if (version.file_snapshots && version.file_snapshots.length > 0) {
        const mainSnapshot = version.file_snapshots.find(f => f.is_main);
        if (mainSnapshot && activeFile) {
          // Create a temp file object with snapshot content
          const tempFile = { ...activeFile, content: mainSnapshot.content };
          setActiveFile(tempFile);
          setEditorContent(mainSnapshot.content);
        }
      } else {
        // Fallback for old versions
        setEditorContent(version.latex_content);
      }
    }
  }
};

  // Restore a version as current
  const handleRestoreVersion = async () => {
    if (!selectedVersion) return;
    
    try {
      if (selectedVersion.file_snapshots && selectedVersion.file_snapshots.length > 0) {
        // Call server-side restore API for atomic operation
        const response = await fetch('/api/versions/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: document.id,
            fileSnapshots: selectedVersion.file_snapshots
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to restore version');
        }
        
        // Refresh file list from database
        await fileManager.refreshFiles();
        
        // Fetch files directly to get the latest state immediately
        const filesResponse = await fetch(`/api/files/list?documentId=${document.id}`);
        const filesData = await filesResponse.json();
        
        if (filesResponse.ok && filesData.files) {
          const mainFile = filesData.files.find((f: DocumentFile) => f.is_main);
          if (mainFile) {
            setActiveFile(mainFile);
            setEditorContent(mainFile.content);
            setCurrentEditorContent(mainFile.content);
          } else {
            console.error('No main file found after restoration');
          }
        }
      } else {
        // Fallback for old versions (only main file)
        // Just update the current active file content
        if (activeFile) {
          await fileManager.updateFile(activeFile.id, selectedVersion.latex_content);
          setEditorContent(selectedVersion.latex_content);
          setCurrentEditorContent(selectedVersion.latex_content);
        }
      }
      
      setIsViewingVersion(false);
      setSelectedVersion(null);
      
      console.log('✅ Version restored successfully');
    } catch (error) {
      console.error('❌ Error restoring version:', error);
      alert('Failed to restore version. Please try again.');
    }
  };

// Handle file selection
const handleFileSelect = useCallback((file: DocumentFile) => {
  // Cancel any pending auto-save
  if (saveTimeoutRef.current) {
    clearTimeout(saveTimeoutRef.current);
  }
  
  // Optimistic update: Save in background if there are changes (fire and forget)
  if (activeFile && editorContent !== activeFile.content && !isViewingVersion) {
    const fileToSave = activeFile;
    const contentToSave = editorContent;
    
    console.log('💾 Background save started:', fileToSave.filename);
    
    // Fire and forget - save happens in background
    fileManager.updateFile(fileToSave.id, contentToSave)
      .then(() => {
        console.log('✅ Background save complete:', fileToSave.filename);
        // Update the activeFile content if it's still the same file
        setActiveFile(prev => 
          prev && prev.id === fileToSave.id 
            ? { ...prev, content: contentToSave } 
            : prev
        );
        // Silently refresh cache after save completes
        return fileManager.refreshFiles();
      })
      .catch((error) => {
        console.error('❌ Background save failed:', error);
        // Could show a toast notification here
      });
  } else if (activeFile) {
    console.log('⚡ Skipping save on switch - no changes detected');
  }
  
  // If viewing a version, load content from the snapshot instead of current files
  if (isViewingVersion && selectedVersion?.file_snapshots) {
    const snapshotFile = selectedVersion.file_snapshots.find(
      f => f.filename === file.filename
    );
    
    if (snapshotFile) {
      console.log('📂 Opening snapshot file:', snapshotFile.filename);
      const tempFile = { ...file, content: snapshotFile.content };
      setActiveFile(tempFile);
      setEditorContent(snapshotFile.content);
      return;
    }
  }
  
  // Instant switch: Use cached file from fileManager.files (no API call!)
  const cachedFile = fileManager.files.find(f => f.id === file.id) || file;
  
  console.log('📂 Opening file:', cachedFile.filename, 'content length:', cachedFile.content.length);
  
  setActiveFile(cachedFile);
  setEditorContent(cachedFile.content);
  setCurrentEditorContent(cachedFile.content);
}, [activeFile, editorContent, isViewingVersion, selectedVersion, fileManager]);

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

  // Undo function
  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    
    const previousContent = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, editorContent]);
    setUndoStack(prev => prev.slice(0, -1));
    setEditorContent(previousContent);
  }, [undoStack, editorContent]);

  // Redo function
  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    
    const nextContent = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, editorContent]);
    setRedoStack(prev => prev.slice(0, -1));
    setEditorContent(nextContent);
  }, [redoStack, editorContent]);

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
  }, [editorContent, pdfCompiler.compileError, handleCompile]); // Dependencies: rerun when these change

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
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">Mode</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="inline-flex items-center justify-center">
                    <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm" side="bottom">
                  <div className="space-y-3">
                    <div className="font-semibold text-sm">AI Editing Modes</div>
                    
                    <div className="space-y-1">
                        <div className="font-medium text-sm">Diff Edit</div>
                        <p className="text-xs text-muted-foreground">
                          AI suggests specific edits with context, which you can review and apply individually or collectively.
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">Use for:</span> Most cases. Faster latency.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <div className="font-medium text-sm">Full Rewrite</div>
                        <p className="text-xs text-muted-foreground">
                          AI rewrites the entire document. Content that is not part of the request is preserved.
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">Use for:</span> Major restructuring, complete rewrites, error correction. Slower latency.
                        </p>
                      </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
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

      {/* Main Layout: Files/Images Panel (left) + Three Panel Layout (right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Files and Images Manager (collapsible) */}
        {(showFileManager || showImageManager) && (
          <>
            <div className="w-64 border-r flex flex-col bg-background">
              {/* Tabs */}
              <div className="flex border-b bg-muted/50">
                <button
                  onClick={() => {
                    setShowFileManager(true);
                    setShowImageManager(false);
                  }}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    showFileManager
                      ? 'bg-muted border-b-2 border-primary text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Files
                </button>
                <button
                  onClick={() => {
                    setShowFileManager(false);
                    setShowImageManager(true);
                  }}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    showImageManager
                      ? 'bg-muted border-b-2 border-primary text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Images
                </button>
              </div>
              
              {/* Content */}
              <div className="flex-1 overflow-hidden">
                {showFileManager && (
                  <FileManager
                    documentId={document.id}
                    activeFileId={activeFile?.id || null}
                    onFileSelect={handleFileSelect}
                  />
                )}
                {showImageManager && (
                  <ImageManager documentId={document.id} />
                )}
              </div>
            </div>
            {/* Divider between panel and editor */}
            <div className="w-1 bg-border" />
          </>
        )}

        {/* Three Panel Layout */}
        <div ref={panelResize.containerRef} className="flex-1 flex overflow-hidden">
          {/* Left Panel - LaTeX Code Editor */}
          <div 
            className="border-r flex flex-col"
            style={{ width: `${panelResize.leftPanelWidth}%` }}
          >
            <div className="bg-muted/50 px-4 py-2 border-b flex items-center justify-between h-10">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    if (showFileManager || showImageManager) {
                      setShowFileManager(false);
                      setShowImageManager(false);
                    } else {
                      setShowFileManager(true);
                    }
                  }}
                  variant="ghost"
                  size="icon-sm"
                  title="Toggle Files/Images Panel"
                  className="h-6 w-6"
                >
                  <FileText className="h-4 w-4" />
                </Button>
                <h2 className="text-sm font-medium">
                  {activeFile?.filename || 'LaTeX Code'} {isViewingVersion && '(Read-Only)'}
                </h2>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <MonacoLaTeXEditor
                value={editorContent}
                onChange={setEditorContent}
                proposedChanges={[]}
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
                disabled={isCompiling}
                size="sm"
              >
                {isCompiling ? 'Compiling...' : 'Compile'}
              </Button>
            </div>
            <div className="flex-1 overflow-hidden relative">
              {panelResize.isResizing && (
                <div className="absolute inset-0 z-50" />
              )}
              
              {isCompiling && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Compiling LaTeX...</p>
                  </div>
                </div>
              )}

              {pdfCompiler.compileError && (
                <div className="p-4 h-full overflow-auto">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-destructive">Compilation Error</h3>
                      <div className="flex items-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="inline-flex items-center justify-center">
                                <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs" side="left">
                              <p className="text-xs">
                              If you get stuck with a compilation error Diff Editing can&apos;t fix, I&apos;d recommend trying Complete Rewrite.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button
                          onClick={handleFixError}
                          size="sm"
                          variant="outline"
                        >
                          Fix In Chat
                        </Button>
                      </div>
                    </div>
                    <pre className="text-xs whitespace-pre-wrap overflow-auto bg-destructive/10 p-3 rounded border border-destructive/30 font-mono text-foreground">
                      {pdfCompiler.compileError}
                    </pre>
                  </div>
                </div>
              )}

              {pdfCompiler.pdfUrl && !isCompiling && (
                <iframe
                  src={pdfCompiler.pdfUrl}
                  className="w-full h-full border-0"
                  title="LaTeX PDF Preview"
                />
              )}

              {!pdfCompiler.pdfUrl && !isCompiling && !pdfCompiler.compileError && (
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
                                  
                                  {/* ⭐ SHOW PROPOSAL for this message */}
                                  {aiEditor.aiProposals[message.id] && (
                                    <div className={`border rounded-lg p-3 mt-3 ${
                                      aiEditor.aiProposals[message.id].isApplied 
                                        ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                                        : aiEditor.aiProposals[message.id].isRejected
                                        ? 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20'
                                        : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                                    }`}>
                                      {/* Description and Confidence */}
                                      <div className="mb-2">
                                        <h4 className={`text-sm font-medium mb-1 ${
                                          aiEditor.aiProposals[message.id].isApplied
                                            ? 'text-green-800 dark:text-green-200'
                                            : aiEditor.aiProposals[message.id].isRejected
                                            ? 'text-gray-600 dark:text-gray-400'
                                            : 'text-blue-800 dark:text-blue-200'
                                        }`}>
                                          {aiEditor.aiProposals[message.id].isApplied 
                                            ? '✓ Applied Complete Rewrite' 
                                            : aiEditor.aiProposals[message.id].isRejected
                                            ? '✗ Rejected Complete Rewrite'
                                            : 'Proposed Complete Rewrite'}
                                        </h4>
                                        {aiEditor.aiProposals[message.id].confidence !== undefined && aiEditor.aiProposals[message.id].confidence > 0 && (
                                          <div className={`text-xs ${
                                            aiEditor.aiProposals[message.id].isApplied
                                              ? 'text-green-600 dark:text-green-400'
                                              : aiEditor.aiProposals[message.id].isRejected
                                              ? 'text-gray-500 dark:text-gray-500'
                                              : 'text-blue-600 dark:text-blue-400'
                                          }`}>
                                            Confidence: {Math.round(aiEditor.aiProposals[message.id].confidence * 100)}%
                                          </div>
                                        )}
                                      </div>

                                      {/* LaTeX Code Preview - STREAMS HERE */}
                                      {aiEditor.aiProposals[message.id].newLatexCode && (
                                        <div className="mb-3">
                                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                            {aiEditor.isAIProcessing ? 'Streaming preview...' : 'Preview:'}
                                          </div>
                                          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-xs font-mono text-gray-800 dark:text-gray-200 max-h-48 overflow-y-auto">
                                            <pre className="whitespace-pre-wrap">{aiEditor.aiProposals[message.id].newLatexCode}</pre>
                                          </div>
                                        </div>
                                      )}

                                      {/* Action Buttons - only when streaming is done AND not applied/rejected */}
                                      {!aiEditor.isAIProcessing && !aiEditor.aiProposals[message.id].isApplied && !aiEditor.aiProposals[message.id].isRejected && (
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => aiEditor.acceptAIProposal(message.id)}
                                            disabled={aiEditor.isApplying}
                                            className="px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors"
                                          >
                                            {aiEditor.isApplying ? 'Applying...' : 'Apply'}
                                          </button>
                                          <button
                                            onClick={() => aiEditor.rejectAIProposal(message.id)}
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
                    ref={chatInputRef}
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
                            
                            {/* ⭐ Show proposed changes for ANY message that has them */}
                            {morphEditor.proposedChangesByMessage[message.id] && 
                             morphEditor.proposedChangesByMessage[message.id].length > 0 && (
                              <div className="space-y-3 mt-3">
                                {morphEditor.proposedChangesByMessage[message.id].map((change) => (
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
                                {!morphEditor.isProcessing && morphEditor.proposedChangesByMessage[message.id].filter(c => !c.isApplied && !c.isRejected).length > 1 && (
                                  <div className="flex gap-2 pt-2">
                                    <button
                                      onClick={() => morphEditor.applyAllChanges(message.id)}
                                      disabled={morphEditor.isApplyingAll || morphEditor.applyingChangeId !== null}
                                      className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors font-medium"
                                    >
                                      {morphEditor.isApplyingAll ? 'Applying All...' : 'Apply All'}
                                    </button>
                                    <button
                                      onClick={() => morphEditor.rejectAllChanges(message.id)}
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
                    ref={chatInputRef}
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
    </div>
  );
}