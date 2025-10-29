import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
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

    // Get document ID from query params
    const searchParams = request.nextUrl.searchParams;
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId is required' },
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

    // Get all images for this document
    const { data: images, error } = await supabase
      .from('images')
      .select('*')
      .eq('document_id', documentId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error fetching images:', error);
      return NextResponse.json(
        { error: 'Failed to fetch images' },
        { status: 500 }
      );
    }

    // Get signed URLs for each image
    const imagesWithUrls = await Promise.all(
      (images || []).map(async (image) => {
        const { data: urlData } = await supabase.storage
          .from('document-images')
          .createSignedUrl(image.storage_path, 3600); // 1 hour expiry

        return {
          ...image,
          url: urlData?.signedUrl || null
        };
      })
    );

    return NextResponse.json({
      success: true,
      images: imagesWithUrls
    });

  } catch (error) {
    console.error('Error listing images:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}