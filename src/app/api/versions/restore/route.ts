import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

interface FileSnapshot {
  filename: string;
  file_type: string;
  content: string;
  is_main: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { documentId, fileSnapshots } = body as {
      documentId: string;
      fileSnapshots: FileSnapshot[];
    };

    if (!documentId || !fileSnapshots || !Array.isArray(fileSnapshots)) {
      return NextResponse.json(
        { error: 'documentId and fileSnapshots are required' },
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

    // Get all current files for this document
    const { data: currentFiles } = await supabase
      .from('document_files')
      .select('*')
      .eq('document_id', documentId);

    const currentFilesMap = new Map(
      (currentFiles || []).map(f => [f.filename, f])
    );
    const snapshotFilenames = new Set(fileSnapshots.map(s => s.filename));

    // Process each snapshot file
    for (const snapshot of fileSnapshots) {
      const existingFile = currentFilesMap.get(snapshot.filename);
      
      if (existingFile) {
        // Update existing file
        await supabase
          .from('document_files')
          .update({
            content: snapshot.content,
            file_type: snapshot.file_type,
            is_main: snapshot.is_main,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingFile.id);
      } else {
        // Create new file
        await supabase
          .from('document_files')
          .insert({
            document_id: documentId,
            filename: snapshot.filename,
            file_type: snapshot.file_type,
            content: snapshot.content,
            is_main: snapshot.is_main,
            display_order: 999
          });
      }
    }

    // Delete files that aren't in the snapshot
    const filesToDelete = (currentFiles || []).filter(
      f => !snapshotFilenames.has(f.filename)
    );
    
    if (filesToDelete.length > 0) {
      await supabase
        .from('document_files')
        .delete()
        .in('id', filesToDelete.map(f => f.id));
    }

    console.log('✅ Version restored:', {
      updated: fileSnapshots.filter(s => currentFilesMap.has(s.filename)).length,
      created: fileSnapshots.filter(s => !currentFilesMap.has(s.filename)).length,
      deleted: filesToDelete.length
    });

    return NextResponse.json({ 
      success: true,
      message: 'Version restored successfully'
    });
  } catch (error) {
    console.error('Error restoring version:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

