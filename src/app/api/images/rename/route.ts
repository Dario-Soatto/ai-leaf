import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { imageId, newFilename } = body;

    if (!imageId || !newFilename) {
      return NextResponse.json({ error: 'Missing imageId or newFilename' }, { status: 400 });
    }

    // Validate filename (basic validation)
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(newFilename)) {
      return NextResponse.json({ error: 'Invalid filename. Use only letters, numbers, hyphens, underscores, and periods.' }, { status: 400 });
    }

    // Update the filename in the database
    const { data: image, error } = await supabase
      .from('images')
      .update({ filename: newFilename })
      .eq('id', imageId)
      .eq('user_id', user.id) // Ensure user owns this image
      .select()
      .single();

    if (error) {
      console.error('Error renaming image:', error);
      return NextResponse.json({ error: 'Failed to rename image' }, { status: 500 });
    }

    return NextResponse.json({ image });
  } catch (error) {
    console.error('Error in rename route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}