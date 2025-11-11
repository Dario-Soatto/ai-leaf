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
    const { currentLatex, userRequest, chatHistory, availableImages, allFiles } = body;

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

    // Build chat history context (only summaries, no code)
    let conversationContext = '';
    if (chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0) {
      conversationContext = '\n\nPrevious conversation:\n' + 
        chatHistory.map((msg: { type: string; content: string }) => 
          `${msg.type === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n');
    }

    let imagesContext = '';
    if (availableImages && Array.isArray(availableImages) && availableImages.length > 0) {
      imagesContext = '\n\nAvailable images:\n' + 
        availableImages.map((img: string) => `- ${img}`).join('\n') +
        '\n\nYou can reference these images using \\includegraphics{filename}';
    }

    let filesContext = '';
    if (allFiles && Array.isArray(allFiles) && allFiles.length > 0) {
      filesContext = '\n\nDocument files:\n' + 
        allFiles.map((file: { filename: string; content: string; is_main: boolean }) => 
          `--- ${file.filename} ${file.is_main ? '(MAIN FILE - currently editing)' : '(auxiliary file)'} ---\n\`\`\`latex\n${file.content}\n\`\`\`\n`
        ).join('\n');
    }

    // Call streamObject
    const result = streamObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: MorphEditResponseSchema,
      prompt: `You are a LaTeX expert. The user wants to modify their LaTeX document.
    
    Current LaTeX document (main file being edited):
    \`\`\`latex
    ${currentLatex}
    \`\`\`
    ${filesContext}
    ${conversationContext}
    ${imagesContext}
    
    User request: "${userRequest}"
    
    Please generate specific changes for the LaTeX document. For each change, provide:
    1. A clear description of what the change does
    2. The edit snippet in Morph format with SUFFICIENT CONTEXT
    3. Your confidence level (0-1)
    
    CRITICAL: Include enough surrounding code for MorphLLM to uniquely identify the location.
    
    Morph Format Rules:
    - Include 2-3 lines of ACTUAL CODE before the change (not just // ... existing code ...)
    - Include 2-3 lines of ACTUAL CODE after the change
    - Use // ... existing code ... only at the START and END to indicate distant sections
    - The surrounding code must be unique enough to locate the edit position
    
    GOOD Example (sufficient context):
    \`\`\`
    // ... existing code ...
    \\section{Introduction}
    This paper explores...
    
    \\section{New Section}
    This is new content I'm adding.
    
    \\section{Methods}
    We used the following...
    // ... existing code ...
    \`\`\`
    
    BAD Example (insufficient context):
    \`\`\`
    // ... existing code ...
    \\section{New Section}
    This is new content.
    // ... existing code ...
    \`\`\`
    
    Guidelines:
    - Break down complex requests into individual, logical changes
    - Each change should be self-contained and independently applicable
    - Provide CONCRETE surrounding lines, not just markers
    - Include enough context that a human could find the location by searching
    - Make sure each change has a clear, specific purpose
    - Consider the conversation context when interpreting requests
    - When using images, only reference files from the available images list
    - Add \\usepackage{graphicx} if suggesting image usage and it's not already present
    - You can reference auxiliary files in the main document
    - IMPORTANT: Changes should only be for the MAIN FILE being edited
    
    Return multiple individual changes that can be applied separately to the MAIN FILE.`
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
