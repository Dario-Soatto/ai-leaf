import { useState, useCallback, useEffect } from 'react';

export interface ImageRecord {
  id: string;
  document_id: string;
  user_id: string;
  filename: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  url: string | null;
}

export function useImageManager(documentId: string | null) {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch images for the document
  const fetchImages = useCallback(async () => {
    if (!documentId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/images/list?documentId=${documentId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch images');
      }

      setImages(data.images || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch images');
      console.error('Error fetching images:', err);
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  // Upload a new image
  const uploadImage = useCallback(async (file: File) => {
    if (!documentId) {
      throw new Error('No document ID provided');
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentId', documentId);

      const response = await fetch('/api/images/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload image');
      }

      // Refresh the image list
      await fetchImages();

      return data.image;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload image';
      setError(errorMessage);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, [documentId, fetchImages]);

  // Delete an image
  const deleteImage = useCallback(async (imageId: string) => {
    setError(null);

    try {
      const response = await fetch('/api/images/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete image');
      }

      // Remove from local state
      setImages(prev => prev.filter(img => img.id !== imageId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete image';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Load images on mount and when documentId changes
  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  return {
    images,
    isLoading,
    isUploading,
    error,
    uploadImage,
    deleteImage,
    refreshImages: fetchImages,
  };
}