import { NextRequest, NextResponse } from 'next/server';
import { MorphApplyRequest, MorphApplyResponse } from '@/lib/morph-types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { instruction, originalCode, codeEdit } = body as MorphApplyRequest;

    // Validate input
    if (!instruction || !originalCode || !codeEdit) {
      return NextResponse.json(
        { error: 'instruction, originalCode, and codeEdit are required' },
        { status: 400 }
      );
    }

    // Get MorphLLM API key from environment
    const morphApiKey = process.env.MORPH_API_KEY;
    if (!morphApiKey) {
      return NextResponse.json(
        { error: 'MorphLLM API key not configured' },
        { status: 500 }
      );
    }

    // Call MorphLLM API
    const response = await fetch('https://api.morphllm.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${morphApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'morph-v3-large',
        messages: [
          {
            role: 'user',
            content: `<instruction>${instruction}</instruction>\n<code>${originalCode}</code>\n<update>${codeEdit}</update>`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MorphLLM API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to apply change via MorphLLM' },
        { status: 500 }
      );
    }

    const result = await response.json();
    const mergedCode = result.choices[0].message.content;

    const morphResponse: MorphApplyResponse = {
      mergedCode,
      success: true
    };

    return NextResponse.json(morphResponse);

  } catch (error) {
    console.error('Morph apply error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to apply change',
        success: false 
      } as MorphApplyResponse,
      { status: 500 }
    );
  }
}
