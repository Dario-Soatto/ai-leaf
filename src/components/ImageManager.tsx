'use client';

import { useRef, useState } from 'react';
import { useImageManager, ImageRecord } from '@/hooks/useImageManager';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface ImageManagerProps {
  documentId: string;
}

export default function ImageManager({ documentId }: ImageManagerProps) {
  const { images, isLoading, isUploading, error, uploadImage, deleteImage } = useImageManager(documentId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadImage(file);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleCopyFilename = (image: ImageRecord) => {
    const command = `\\includegraphics{${image.filename}}`;
    navigator.clipboard.writeText(command);
    setCopiedId(image.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return;
    
    try {
      await deleteImage(imageId);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-muted/50 px-4 py-2 border-b flex items-center justify-between">
        <h2 className="text-sm font-medium">Document Images</h2>
        <Button
          onClick={handleUploadClick}
          disabled={isUploading}
          size="sm"
        >
          {isUploading ? 'Uploading...' : '+ Upload'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/svg+xml,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <div className="flex-1 overflow-auto p-4">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              No images uploaded yet
            </p>
            <p className="text-xs text-muted-foreground">
              Upload images to include them in your LaTeX document
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {images.map((image) => (
              <div
                key={image.id}
                className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Image thumbnail */}
                  {image.url && image.mime_type.startsWith('image/') && (
                    <img
                      src={image.url}
                      alt={image.filename}
                      className="w-12 h-12 object-cover rounded border"
                    />
                  )}
                  {image.mime_type === 'application/pdf' && (
                    <div className="w-12 h-12 flex items-center justify-center bg-red-100 dark:bg-red-900/20 rounded border">
                      <span className="text-xs font-medium text-red-600 dark:text-red-400">PDF</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" title={image.filename}>
                      {image.filename}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {formatFileSize(image.file_size)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(image.uploaded_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      onClick={() => handleCopyFilename(image)}
                      size="sm"
                      variant="ghost"
                      title="Copy \includegraphics command"
                    >
                      {copiedId === image.id ? '✓' : '📋'}
                    </Button>
                    <Button
                      onClick={() => handleDelete(image.id)}
                      size="sm"
                      variant="ghost"
                      title="Delete image"
                    >
                      🗑️
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t p-3 bg-muted/20">
        <p className="text-xs text-muted-foreground">
          💡 Click 📋 to copy <code className="text-xs">\includegraphics</code> command
        </p>
      </div>
    </div>
  );
}