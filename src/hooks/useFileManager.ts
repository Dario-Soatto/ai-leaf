import { useState, useCallback, useEffect } from 'react';

export interface DocumentFile {
  id: string;
  document_id: string;
  filename: string;
  file_type: 'tex' | 'bib' | 'cls' | 'sty' | 'bst';
  content: string;
  is_main: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export type FileType = 'tex' | 'bib' | 'cls' | 'sty' | 'bst';

export function useFileManager(documentId: string | null) {
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch files for the document
  const fetchFiles = useCallback(async () => {
    if (!documentId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/files/list?documentId=${documentId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch files');
      }

      setFiles(data.files || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch files');
      console.error('Error fetching files:', err);
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  // Create a new file
  const createFile = useCallback(async (filename: string, fileType: FileType, content: string = '') => {
    if (!documentId) {
      throw new Error('No document ID provided');
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/files/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          filename,
          fileType,
          content,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create file');
      }

      // Refresh the file list
      await fetchFiles();

      return data.file;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create file';
      setError(errorMessage);
      throw err;
    } finally {
      setIsCreating(false);
    }
  }, [documentId, fetchFiles]);

  // Update file content
  const updateFile = useCallback(async (fileId: string, content: string) => {
    setError(null);

    try {
      const response = await fetch('/api/files/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, content }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update file');
      }

      // Update local state
      setFiles(prev => prev.map(file => 
        file.id === fileId 
          ? { ...file, content, updated_at: new Date().toISOString() }
          : file
      ));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update file';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Delete a file
  const deleteFile = useCallback(async (fileId: string) => {
    setError(null);

    try {
      const response = await fetch('/api/files/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete file');
      }

      // Remove from local state
      setFiles(prev => prev.filter(file => file.id !== fileId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete file';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Load files on mount and when documentId changes
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return {
    files,
    isLoading,
    isCreating,
    error,
    createFile,
    updateFile,
    deleteFile,
    refreshFiles: fetchFiles,
  };
}