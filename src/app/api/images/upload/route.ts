import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
  'application/pdf'
];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentId = formData.get('documentId') as string;

    if (!file || !documentId) {
      return NextResponse.json(
        { error: 'File and documentId are required' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PNG, JPG, SVG, and PDF are allowed.' },
        { status: 400 }
      );
    }

    // Verify user owns the document
    const { data: document } = await supabase
      .from('documents')
      .select('id')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found or access denied' },
        { status: 403 }
      );
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const uniqueFilename = `${file.name.split('.')[0]}-${timestamp}-${randomStr}.${fileExt}`;
    const storagePath = `documents/${documentId}/images/${uniqueFilename}`;

    // Upload to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('document-images')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Create database record
    const { data: imageRecord, error: dbError } = await supabase
      .from('images')
      .insert({
        document_id: documentId,
        user_id: user.id,
        filename: file.name, // Keep original filename
        storage_path: storagePath,
        file_size: file.size,
        mime_type: file.type
      })
      .select()
      .single();

    if (dbError) {
      // Clean up uploaded file
      await supabase.storage.from('document-images').remove([storagePath]);
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to create image record' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      image: imageRecord
    });

  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}