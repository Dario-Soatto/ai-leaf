import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Step 1: Get the LaTeX code from the request body
    const body = await request.json();
    const { latex } = body;

    // Step 2: Validate that we have LaTeX code
    if (!latex || typeof latex !== 'string') {
      return NextResponse.json(
        { error: 'LaTeX code is required' },
        { status: 400 }
      );
    }

    // Step 3: Check if the LaTeX code is too large (prevent abuse)
    if (latex.length > 100000) { // 100KB limit
      return NextResponse.json(
        { error: 'LaTeX document is too large' },
        { status: 400 }
      );
    }

    // Step 4: Call LaTeX.Online API using GET request with text parameter
    // Based on the documentation, we need to use GET with query parameters
    const encodedLatex = encodeURIComponent(latex);
    const latexOnlineUrl = `https://latexonline.cc/compile?text=${encodedLatex}&command=pdflatex`;
    
    const latexOnlineResponse = await fetch(latexOnlineUrl, {
      method: 'GET',
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    // Step 5: Check if LaTeX.Online responded successfully
    if (!latexOnlineResponse.ok) {
      // Try to get error details from LaTeX.Online
      let errorMessage = 'LaTeX compilation failed';
      try {
        const errorData = await latexOnlineResponse.text();
        errorMessage = errorData || errorMessage;
      } catch (e) {
        // If we can't parse the error, use default message
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    // Step 6: Get the PDF data
    const pdfBuffer = await latexOnlineResponse.arrayBuffer();

    // Step 7: Return the PDF to the frontend
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
    // Step 8: Handle any unexpected errors
    console.error('LaTeX compilation error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
