import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // ⭐ Service role key, not anon key
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { latex } = body;

    if (!latex || typeof latex !== 'string') {
      return NextResponse.json(
        { error: 'LaTeX code is required' },
        { status: 400 }
      );
    }

    // Generate a unique filename
    const filename = `temp-latex-${Date.now()}-${Math.random().toString(36).substring(7)}.tex`;
    const filePath = `temp/${filename}`;

    // Step 1: Upload LaTeX content to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('latex-files')
      .upload(filePath, latex, {
        contentType: 'text/plain',
        cacheControl: '0',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: `Failed to upload LaTeX file: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Step 2: Get public URL for the file
    const { data: urlData } = supabase.storage
      .from('latex-files')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    // Step 3: Call LaTeX Online with the URL
    const latexOnlineUrl = `https://latexonline.cc/compile?url=${encodeURIComponent(publicUrl)}&command=pdflatex`;
    
    const latexOnlineResponse = await fetch(latexOnlineUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(60000)
    });

    // Step 4: Delete the temporary file (don't wait for it)
    supabase.storage
      .from('latex-files')
      .remove([filePath])
      .catch(err => console.error('Failed to delete temp file:', err));

    // Step 5: Check compilation result
    if (!latexOnlineResponse.ok) {
      let errorMessage = 'LaTeX compilation failed';
      try {
        const errorData = await latexOnlineResponse.text();
        errorMessage = errorData || errorMessage;
      } catch (e) {
        // Use default error message
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    // Step 6: Return the PDF
    const pdfBuffer = await latexOnlineResponse.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('LaTeX compilation error:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
