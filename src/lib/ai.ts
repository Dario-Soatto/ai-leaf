import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';

export interface LaTeXEditRequest {
  currentLatex: string;
  userRequest: string;
}

export interface LaTeXEditResponse {
  message: string;
  newLatexCode: string;
  confidence: number;
  changes: string[];
}

// Define the Zod schema
const LaTeXEditResponseSchema = z.object({
  message: z.string().describe('Brief explanation of what changes were made'),
  newLatexCode: z.string().describe('The complete modified LaTeX document'),
  confidence: z.number().min(0).max(1).describe('Confidence level from 0 to 1'),
  changes: z.array(z.string()).describe('List of specific changes made')
});

export async function editLaTeXDocument(request: LaTeXEditRequest): Promise<LaTeXEditResponse> {
  const { currentLatex, userRequest } = request;

  const result = await generateObject({
    model: anthropic('claude-3-5-sonnet-20241022'),
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

  return result.object;
}
