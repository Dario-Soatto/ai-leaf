import { NextRequest, NextResponse } from 'next/server';
import { editLaTeXDocument } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentLatex, userRequest } = body;

    // Validate input
    if (!currentLatex || !userRequest) {
      return NextResponse.json(
        { error: 'Both currentLatex and userRequest are required' },
        { status: 400 }
      );
    }

    if (typeof currentLatex !== 'string' || typeof userRequest !== 'string') {
      return NextResponse.json(
        { error: 'currentLatex and userRequest must be strings' },
        { status: 400 }
      );
    }

    // Call AI service
    const result = await editLaTeXDocument({
      currentLatex,
      userRequest
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('AI edit error:', error);
    
    return NextResponse.json(
      { error: 'Failed to process AI request' },
      { status: 500 }
    );
  }
}
