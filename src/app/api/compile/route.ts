import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Helper function to extract image filenames from LaTeX code
function extractImageFilenames(latexCode: string): string[] {
  const imageRegex = /\\includegraphics(?:\[.*?\])?\{([^}]+)\}/g;
  const filenames: string[] = [];
  let match;

  while ((match = imageRegex.exec(latexCode)) !== null) {
    filenames.push(match[1]);
  }

  return filenames;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { latex, documentId } = body;

    if (!latex || typeof latex !== 'string') {
      return NextResponse.json(
        { error: 'LaTeX code is required' },
        { status: 400 }
      );
    }

    // Extract image filenames from LaTeX
    const imageFilenames = extractImageFilenames(latex);
    console.log('Found image references:', imageFilenames);

    // Create form data for texlive.net
    const formData = new FormData();
    
    // Required: engine parameter
    formData.append('engine', 'pdflatex');
    
    // Required: return parameter (pdf to get the PDF directly)
    formData.append('return', 'pdf');

    // Add the main LaTeX file
    formData.append('filename[]', 'document.tex');
    formData.append('filecontents[]', latex);

    // Fetch and add images if there are any
    if (imageFilenames.length > 0 && documentId) {
      console.log('Fetching images from Supabase...');

      const { data: images, error: dbError } = await supabase
        .from('images')
        .select('*')
        .eq('document_id', documentId);

      if (dbError) {
        console.error('Error fetching images:', dbError);
        return NextResponse.json(
          { error: 'Failed to fetch document images' },
          { status: 500 }
        );
      }

      // Create a map of filename -> image data
      const imageMap = new Map(images?.map(img => [img.filename, img]) || []);

      // Download and add each referenced image
      for (const filename of imageFilenames) {
        const imageRecord = imageMap.get(filename);
        
        if (imageRecord) {
          console.log(`Downloading image: ${filename}`);
          
          // Download image from Supabase Storage
          const { data: imageData, error: downloadError } = await supabase.storage
            .from('document-images')
            .download(imageRecord.storage_path);

          if (downloadError) {
            console.error(`Error downloading ${filename}:`, downloadError);
            continue; // Skip this image, let LaTeX show the error
          }

          // Add to form data
          const blob = new Blob([await imageData.arrayBuffer()]);
          formData.append('filename[]', filename);
          formData.append('filecontents[]', blob);
          
          console.log(`Added image to submission: ${filename}`);
        } else {
          console.warn(`Image referenced but not found: ${filename}`);
          // Continue anyway - LaTeX will show the error
        }
      }
    }

    // Submit to texlive.net
    console.log('Submitting to texlive.net...');
    const texliveResponse = await fetch('https://texlive.net/cgi-bin/latexcgi', {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(60000) // 60 second timeout
    });

    // Check if we got a PDF or an error log
    const contentType = texliveResponse.headers.get('Content-Type');
    console.log('Response Content-Type:', contentType);

    // If it's not a PDF, it's an error log
    if (!contentType || !contentType.includes('application/pdf')) {
      let errorMessage = 'LaTeX compilation failed';
      try {
        const logText = await texliveResponse.text();
        console.log('Compilation log:', logText);
        errorMessage = logText || errorMessage;
      } catch (e) {
        // Use default error message
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    // Get the PDF
    const pdfBuffer = await texliveResponse.arrayBuffer();

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