import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { documentId, filename, fileType, content = '' } = body;

    if (!documentId || !filename || !fileType) {
      return NextResponse.json(
        { error: 'documentId, filename, and fileType are required' },
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
      return NextResponse.json({ error: 'Document not found' }, { status: 403 });
    }

    // Create the file
    const { data: file, error } = await supabase
      .from('document_files')
      .insert({
        document_id: documentId,
        filename,
        file_type: fileType,
        content,
        is_main: false,
        display_order: 999 // Will be at the end
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating file:', error);
      return NextResponse.json({ error: 'Failed to create file' }, { status: 500 });
    }

    return NextResponse.json({ success: true, file });
  } catch (error) {
    console.error('Error creating file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}