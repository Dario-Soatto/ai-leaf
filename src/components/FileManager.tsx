'use client';

import { useState, useRef } from 'react';
import { useFileManager, DocumentFile, FileType } from '@/hooks/useFileManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { File, FilePlus, Trash2, Star, Upload } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


interface FileManagerProps {
  documentId: string;
  activeFileId: string | null;
  onFileSelect: (file: DocumentFile) => void;
}

// File type templates
const FILE_TEMPLATES: Record<FileType, string> = {
  tex: `\\documentclass{article}
\\begin{document}

\\end{document}`,
  bib: `@article{example2024,
  author = {Author Name},
  title = {Article Title},
  journal = {Journal Name},
  year = {2024}
}`,
  cls: `% Custom LaTeX class file
\\NeedsTeXFormat{LaTeX2e}
\\ProvidesClass{customclass}[2024/01/01 Custom Class]
\\LoadClass{article}`,
  sty: `% Custom LaTeX package
\\NeedsTeXFormat{LaTeX2e}
\\ProvidesPackage{custompackage}[2024/01/01 Custom Package]`,
  bst: `% BibTeX style file
% Add your custom bibliography style here`,
};

const FILE_TYPE_LABELS: Record<FileType, string> = {
  tex: 'LaTeX Document',
  bib: 'Bibliography',
  cls: 'Document Class',
  sty: 'Style Package',
  bst: 'BibTeX Style',
};

export default function FileManager({ documentId, activeFileId, onFileSelect }: FileManagerProps) {
  const { files, isLoading, isCreating, error, createFile, deleteFile } = useFileManager(documentId);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newFilename, setNewFilename] = useState('');
  const [newFileType, setNewFileType] = useState<FileType>('tex');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateFile = async () => {
    if (!newFilename.trim()) return;

    // Add extension if not present
    let filename = newFilename.trim();
    if (!filename.endsWith(`.${newFileType}`)) {
      filename = `${filename}.${newFileType}`;
    }

    try {
      const template = FILE_TEMPLATES[newFileType];
      const newFile = await createFile(filename, newFileType, template);
      
      // Reset form
      setNewFilename('');
      setNewFileType('tex');
      setIsCreatingNew(false);
      
      // Auto-select the new file
      if (newFile) {
        onFileSelect(newFile);
      }
    } catch (err) {
      console.error('Create file failed:', err);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file extension
    const validExtensions = ['tex', 'bib', 'cls', 'sty', 'bst'];
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (!extension || !validExtensions.includes(extension)) {
      alert(`Invalid file type. Please upload a ${validExtensions.join(', ')} file.`);
      return;
    }

    // Validate file size (max 1MB for text files)
    const maxSize = 1024 * 1024; // 1MB
    if (file.size > maxSize) {
      alert('File is too large. Maximum size is 1MB.');
      return;
    }

    try {
      // Read file content
      const content = await file.text();
      
      // Create the file using existing function
      const newFile = await createFile(
        file.name, 
        extension as FileType, 
        content
      );
      
      // Auto-select the new file
      if (newFile) {
        onFileSelect(newFile);
      }
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload file. Please try again.');
    }
  };

  const handleDelete = async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    if (file.is_main) {
      alert('Cannot delete the main file');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${file.filename}?`)) return;
    
    try {
      await deleteFile(fileId);
      
      // If deleted file was active, switch to main file
      if (activeFileId === fileId) {
        const mainFile = files.find(f => f.is_main);
        if (mainFile) {
          onFileSelect(mainFile);
        }
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const getFileIcon = (fileType: FileType) => {
    return <File className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Loading files...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Files</h3>
        <div className="flex gap-1">
          {/* Upload button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-7 w-7 p-0"
            title="Upload File"
          >
            <Upload className="h-4 w-4" />
          </Button>
          
          {/* Create new button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCreatingNew(!isCreatingNew)}
            className="h-7 w-7 p-0"
            title="New File"
          >
            <FilePlus className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".tex,.bib,.cls,.sty,.bst"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Error display */}
      {error && (
        <Alert variant="destructive" className="m-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* New file form */}
      {isCreatingNew && (
        <div className="p-3 border-b border-gray-700 space-y-2 bg-gray-800/50">
          <Input
            type="text"
            placeholder="Filename"
            value={newFilename}
            onChange={(e) => setNewFilename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFile();
              if (e.key === 'Escape') {
                setIsCreatingNew(false);
                setNewFilename('');
              }
            }}
            className="h-8 text-sm"
            autoFocus
          />
          <Select value={newFileType} onValueChange={(value) => setNewFileType(value as FileType)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(FILE_TYPE_LABELS).map(([type, label]) => (
                <SelectItem key={type} value={type}>
                  {label} (.{type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCreateFile}
              disabled={isCreating || !newFilename.trim()}
              className="flex-1 h-7"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsCreatingNew(false);
                setNewFilename('');
              }}
              className="h-7"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 text-center">
            No files yet. Click + to create one.
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {files.map((file) => (
              <div
                key={file.id}
                className={`
                  group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer
                  transition-colors
                  ${activeFileId === file.id 
                    ? 'bg-blue-600/20 border border-blue-600/50' 
                    : 'hover:bg-gray-700/50'
                  }
                `}
                onClick={() => onFileSelect(file)}
              >
                {/* File icon and name */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {getFileIcon(file.file_type)}
                  <span className={`text-sm truncate ${activeFileId === file.id ? 'text-blue-400 font-medium' : 'text-gray-300'}`}>
                    {file.filename}
                  </span>
                  {file.is_main && (
                    <span title="Main file">
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                    </span>
                  )}
                </div>
                  
                {/* Delete button (hidden for main file) */}
                {!file.is_main && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(file.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-opacity"
                    title="Delete file"
                  >
                    <Trash2 className="h-3 w-3 text-red-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="p-2 border-t border-gray-700 text-xs text-gray-500">
        {files.length} file{files.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}