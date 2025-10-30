'use client';

import { useRef, useState } from 'react';
import { useImageManager, ImageRecord } from '@/hooks/useImageManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Trash2, Check, FileImage, Upload } from 'lucide-react';

interface ImageManagerProps {
  documentId: string;
}

export default function ImageManager({ documentId }: ImageManagerProps) {
  const { images, isLoading, isUploading, error, uploadImage, deleteImage, renameImage } = useImageManager(documentId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [editingFilename, setEditingFilename] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadImage(file);
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

  // Filename editing handlers
  const startEditing = (image: ImageRecord) => {
    setEditingImageId(image.id);
    setEditingFilename(image.filename);
  };

  const cancelEditing = () => {
    setEditingImageId(null);
    setEditingFilename('');
  };

  const saveFilename = async (imageId: string) => {
    if (!editingFilename.trim()) {
      cancelEditing();
      return;
    }

    try {
      await renameImage(imageId, editingFilename.trim());
      cancelEditing();
    } catch (err) {
      console.error('Rename failed:', err);
      // Error is already shown via the error state
    }
  };

  const handleFilenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, imageId: string) => {
    if (e.key === 'Enter') {
      saveFilename(imageId);
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload an image file (PNG, JPG, SVG) or PDF');
      return;
    }

    try {
      await uploadImage(file);
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-muted/50 px-4 py-2 border-b flex items-center justify-between h-10">
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

      <div 
        className="flex-1 overflow-auto relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary z-10 flex items-center justify-center">
            <div className="text-center">
              <Upload className="h-12 w-12 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium text-primary">Drop image here</p>
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="m-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <FileImage className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-1">
              No images uploaded yet
            </p>
            <p className="text-xs text-muted-foreground">
              Drag & drop or click Upload
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {images.map((image) => (
              <div
                key={image.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors group"
              >
                {image.url && image.mime_type.startsWith('image/') ? (
                  <img
                    src={image.url}
                    alt={image.filename}
                    className="w-10 h-10 object-cover rounded border flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 flex items-center justify-center bg-muted rounded border flex-shrink-0">
                    <FileImage className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {editingImageId === image.id ? (
                    <Input
                      type="text"
                      value={editingFilename}
                      onChange={(e) => setEditingFilename(e.target.value)}
                      onBlur={() => saveFilename(image.id)}
                      onKeyDown={(e) => handleFilenameKeyDown(e, image.id)}
                      autoFocus
                      className="h-7 text-sm"
                    />
                  ) : (
                    <p 
                      className="text-sm font-medium truncate cursor-pointer hover:text-primary transition-colors" 
                      title={`${image.filename} (click to edit)`}
                      onClick={() => startEditing(image)}
                    >
                      {image.filename}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(image.file_size)}
                  </p>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    onClick={() => handleCopyFilename(image)}
                    size="icon-sm"
                    variant="ghost"
                    title="Copy \includegraphics command"
                    className="h-7 w-7"
                  >
                    {copiedId === image.id ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    onClick={() => handleDelete(image.id)}
                    size="icon-sm"
                    variant="ghost"
                    title="Delete image"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t px-4 py-2 bg-muted/20">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Copy className="h-3 w-3" />
          <span>Click to copy <code className="text-xs">\includegraphics</code> command</span>
        </p>
      </div>
    </div>
  );
}