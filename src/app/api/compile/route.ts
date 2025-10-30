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

    // Add the main LaTeX file with nonstopmode
    const latexWithNonstop = `\\nonstopmode\n${latex}`;
    formData.append('filename[]', 'document.tex');
    formData.append('filecontents[]', latexWithNonstop);

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
          // Don't add anything - LaTeX will show its default missing image placeholder
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

    // Check response
    const contentType = texliveResponse.headers.get('Content-Type');
    console.log('Response Content-Type:', contentType);
    console.log('Response status:', texliveResponse.status);
    console.log('Response ok:', texliveResponse.ok);

    // Get the response buffer
    const buffer = await texliveResponse.arrayBuffer();
    console.log('Response size:', buffer.byteLength, 'bytes');

    // Check if it's a PDF or log text
    if (!contentType || !contentType.includes('application/pdf')) {
      const logText = new TextDecoder().decode(buffer);
      console.log('Received text response, checking for PDF output...');
      
      // Check if PDF was actually generated (even with warnings/errors)
      if (logText.includes('Output written on document.pdf')) {
        // PDF was generated successfully despite warnings
        // Unfortunately texlive.net returned the log instead of PDF
        // This happens when exit code is non-zero
        console.log('PDF was generated with warnings, but texlive.net returned log instead');
        
        // For missing images, we can still show success since the PDF exists
        // Extract just the relevant error/warning portion
        const warningMatch = logText.match(/LaTeX Warning:.*$/m);
        const warningMessage = warningMatch ? warningMatch[0] : 'Compilation completed with warnings';
        
        return NextResponse.json({ 
          error: `${warningMessage}\n\nNote: PDF was generated but contains placeholder boxes for missing images.`
        }, { status: 500 }); // Still return 500 so frontend shows error, but with helpful message
      }
      
      // No PDF was generated - real error
      console.log('Compilation failed, no PDF generated');
      return NextResponse.json({ error: logText }, { status: 500 });
    }

    // Return the PDF buffer
    return new NextResponse(buffer, {
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