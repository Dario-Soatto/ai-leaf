// A single proposed change from the AI
export interface ProposedChange {
  id: string;
  description: string; // Human-readable description of what this change does
  codeEdit: string; // The actual edit snippet in Morph format (with // ... existing code ...)
  confidence: number; // AI's confidence in this change (0-1)
  isApplied?: boolean; // ⭐ ADD THIS
  isRejected?: boolean;  // ⭐ ADD THIS
}

// The overall state for the Morph editor
export interface MorphEditorState {
  isProcessing: boolean;
  proposedChanges: ProposedChange[];
  chatMessages: ChatMessage[];
  hasActiveProposal: boolean;
  currentLatex: string; // Current state of the LaTeX file
}

// Chat message interface (reused from existing system)
export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Request/Response interfaces for the API
export interface MorphEditRequest {
  currentLatex: string;
  userRequest: string;
}

export interface MorphEditResponse {
  message: string;
  changes: ProposedChange[];
  confidence: number;
}

// Interface for MorphLLM API integration (matches their actual API)
export interface MorphApplyRequest {
  instruction: string; // What the AI is trying to do
  originalCode: string; // The current LaTeX code
  codeEdit: string; // The edit snippet with // ... existing code ... markers
}

export interface MorphApplyResponse {
  mergedCode: string; // The final merged result
  success: boolean;
  error?: string;
}
