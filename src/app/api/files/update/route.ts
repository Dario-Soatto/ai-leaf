import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { fileId, content } = body;

    if (!fileId || content === undefined) {
      return NextResponse.json(
        { error: 'fileId and content are required' },
        { status: 400 }
      );
    }

    // Verify ownership through document
    const { data: file } = await supabase
      .from('document_files')
      .select('document_id')
      .eq('id', fileId)
      .single();

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
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

    // Update the file
    // Update the file
    console.log('Attempting to update file:', fileId, 'with content length:', content.length);
    const { error: updateError, data: updateResult } = await supabase
    .from('document_files')
    .update({ 
        content,
        updated_at: new Date().toISOString()
    })
    .eq('id', fileId)
    .select();

    console.log('Update result:', updateResult);

    if (updateError) {
    console.error('Error updating file:', updateError);
    return NextResponse.json({ error: 'Failed to update file', details: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}