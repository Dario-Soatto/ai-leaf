import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import { MorphEditRequest, MorphEditResponse, ProposedChange } from '@/lib/morph-types';
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
    const { currentLatex, userRequest } = body as MorphEditRequest;

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

    // Call AI to generate proposed changes
    const result = await generateObject({
      model: anthropic('claude-3-5-sonnet-20241022'),
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

    // Generate unique IDs for each change
    const changesWithIds: ProposedChange[] = result.object.changes.map(change => ({
      id: randomUUID(),
      description: change.description,
      codeEdit: change.codeEdit,
      confidence: change.confidence
    }));

    const response: MorphEditResponse = {
      message: result.object.message,
      changes: changesWithIds,
      confidence: result.object.confidence
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Morph AI edit error:', error);
    
    return NextResponse.json(
      { error: 'Failed to process AI request' },
      { status: 500 }
    );
  }
}
