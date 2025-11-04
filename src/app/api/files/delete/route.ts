import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { fileId } = body;

    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
    }

    // Verify ownership and check if it's the main file
    const { data: file } = await supabase
      .from('document_files')
      .select('document_id, is_main')
      .eq('id', fileId)
      .single();

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (file.is_main) {
      return NextResponse.json(
        { error: 'Cannot delete the main file' },
        { status: 400 }
      );
    }

    const { data: document } = await supabase
      .from('documents')
      .select('id')
      .eq('id', file.document_id)
      .eq('user_id', user.id)
      .single();

    if (!document) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Delete the file
    const { error: deleteError } = await supabase
      .from('document_files')
      .delete()
      .eq('id', fileId);

    if (deleteError) {
      console.error('Error deleting file:', deleteError);
      return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}