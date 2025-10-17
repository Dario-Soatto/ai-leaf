import { NextRequest } from 'next/server';
import { anthropic } from '@ai-sdk/anthropic';
import { streamObject } from 'ai';
import { z } from 'zod';

const LaTeXEditResponseSchema = z.object({
  message: z.string().describe('Brief explanation of what changes were made'),
  newLatexCode: z.string().describe('The complete modified LaTeX document'),
  confidence: z.number().min(0).max(1).describe('Confidence level from 0 to 1'),
  changes: z.array(z.string()).describe('List of specific changes made')
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentLatex, userRequest } = body;

    // Validate input
    if (!currentLatex || !userRequest) {
      return new Response(
        JSON.stringify({ error: 'Both currentLatex and userRequest are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (typeof currentLatex !== 'string' || typeof userRequest !== 'string') {
      return new Response(
        JSON.stringify({ error: 'currentLatex and userRequest must be strings' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Backend] Starting streamObject...');

    // Call streamObject
    const result = streamObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: LaTeXEditResponseSchema,
      prompt: `You are a LaTeX expert. The user wants to modify their LaTeX document.

Current LaTeX document:
\`\`\`latex
${currentLatex}
\`\`\`

User request: "${userRequest}"

Please modify the LaTeX document according to the user's request. Return the complete modified document.

Guidelines:
- Maintain proper LaTeX structure and syntax
- Add necessary packages if required
- Ensure the document compiles correctly
- Make only the requested changes
- Preserve existing content unless specifically asked to modify it
- Use proper LaTeX formatting and environments

Return the complete modified LaTeX document.`
    });

    console.log('[Backend] streamObject created, starting to iterate...');

    // Create a custom streaming response using partialObjectStream
    const encoder = new TextEncoder();
    let chunkCount = 0;
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log('[Backend] Stream started');
          for await (const partialObject of result.partialObjectStream) {
            chunkCount++;
            console.log(`[Backend] Chunk ${chunkCount}:`, {
              hasMessage: !!partialObject.message,
              messageLength: partialObject.message?.length,
              hasNewLatexCode: !!partialObject.newLatexCode,
              newLatexCodeLength: partialObject.newLatexCode?.length,
              hasConfidence: partialObject.confidence !== undefined,
              hasChanges: !!partialObject.changes
            });
            
            // Send each partial object as a line of JSON
            const chunk = JSON.stringify(partialObject) + '\n';
            controller.enqueue(encoder.encode(chunk));
          }
          console.log(`[Backend] Stream complete. Total chunks: ${chunkCount}`);
          controller.close();
        } catch (error) {
          console.error('[Backend] Stream error:', error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('[Backend] AI edit error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Failed to process AI request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
