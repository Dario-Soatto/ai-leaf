import { NextRequest } from 'next/server';
import { anthropic } from '@ai-sdk/anthropic';
import { streamObject } from 'ai';
import { z } from 'zod';
import { ProposedChange } from '@/lib/morph-types';
import { randomUUID } from 'crypto';

// Zod schema for a single proposed change (without ID - we'll generate that)
const ProposedChangeWithoutIdSchema = z.object({
  description: z.string().describe('Human-readable description of what this change does'),
  codeEdit: z.string().describe('The edit snippet in Morph format with // ... existing code ... markers'),
  confidence: z.number().min(0).max(1).describe('Confidence level from 0 to 1')
});

// Zod schema for the AI response
const MorphEditResponseSchema = z.object({
  message: z.string().describe('Brief explanation of what changes were proposed'),
  changes: z.array(ProposedChangeWithoutIdSchema).describe('Array of proposed changes'),
  confidence: z.number().min(0).max(1).describe('Overall confidence level')
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

    console.log('[Backend Morph] Starting streamObject...');

    // Call streamObject
    const result = streamObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: MorphEditResponseSchema,
      prompt: `You are a LaTeX expert. The user wants to modify their LaTeX document.

Current LaTeX document:
\`\`\`latex
${currentLatex}
\`\`\`

User request: "${userRequest}"

Please generate specific changes for the LaTeX document. For each change, provide:
1. A clear description of what the change does
2. The edit snippet in Morph format using // ... existing code ... markers
3. Your confidence level (0-1)

IMPORTANT: Use the Morph edit format with // ... existing code ... markers to indicate unchanged sections.

Example format:
// ... existing code ...
\\section{New Section}
This is a new section I'm adding.
// ... existing code ...

Guidelines:
- Break down complex requests into individual, logical changes
- Each change should be self-contained and independently applicable
- Use // ... existing code ... to mark unchanged sections
- Provide sufficient context around changes to avoid ambiguity
- Make sure each change has a clear, specific purpose

Return multiple individual changes that can be applied separately.`
    });

    console.log('[Backend Morph] streamObject created, starting to iterate...');

    // Create a custom streaming response using partialObjectStream
    const encoder = new TextEncoder();
    let chunkCount = 0;
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log('[Backend Morph] Stream started');
          for await (const partialObject of result.partialObjectStream) {
            chunkCount++;
            
            // Generate unique IDs for each change in this partial object
            const partialWithIds = {
              message: partialObject.message,
              changes: partialObject.changes?.map(change => ({
                id: randomUUID(),
                description: change?.description,
                codeEdit: change?.codeEdit,
                confidence: change?.confidence
              })).filter(change => change.description || change.codeEdit) || [],
              confidence: partialObject.confidence
            };
            
            console.log(`[Backend Morph] Chunk ${chunkCount}:`, {
              hasMessage: !!partialWithIds.message,
              changeCount: partialWithIds.changes.length,
              hasConfidence: partialWithIds.confidence !== undefined
            });
            
            // Send each partial object as a line of JSON
            const chunk = JSON.stringify(partialWithIds) + '\n';
            controller.enqueue(encoder.encode(chunk));
          }
          console.log(`[Backend Morph] Stream complete. Total chunks: ${chunkCount}`);
          controller.close();
        } catch (error) {
          console.error('[Backend Morph] Stream error:', error);
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
    console.error('[Backend Morph] AI edit error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Failed to process AI request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
