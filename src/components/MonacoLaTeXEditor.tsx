'use client';

import { useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { ProposedChange } from '@/lib/morph-types';
import type { editor } from 'monaco-editor';

interface MonacoLaTeXEditorProps {
  value: string;
  onChange: (value: string) => void;
  proposedChanges: ProposedChange[];
  onApplyChange: (changeId: string) => void;
  onRejectChange: (changeId: string) => void;
  readOnly?: boolean;
}

interface ParsedChange {
  change: ProposedChange;
  startLine: number;
  endLine: number;
  type: 'add' | 'delete' | 'modify';
  content: string;
}

export default function MonacoLaTeXEditor({
  value,
  onChange,
  proposedChanges,
  onApplyChange,
  onRejectChange,
  readOnly = false
}: MonacoLaTeXEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [decorations, setDecorations] = useState<string[]>([]);
  const [containerHeight, setContainerHeight] = useState(400);

  // Parse proposed changes to find line positions and content
  const parseChanges = (changes: ProposedChange[]): ParsedChange[] => {
    const lines = value.split('\n');
    const parsedChanges: ParsedChange[] = [];

    changes.forEach(change => {
      const codeEdit = change.codeEdit;
      
      // Skip changes that don't have codeEdit yet (streaming in progress)
      if (!codeEdit) {
        return;
      }
      
      const editLines = codeEdit.split('\n');
      
      // Find where this change should be applied by looking for context
      let bestMatch = { startLine: 1, endLine: 1, score: 0 };
      let changeContent = '';
      let changeType: 'add' | 'delete' | 'modify' = 'modify';
      
      // Look for the change in the original code
      for (let i = 0; i < lines.length; i++) {
        let score = 0;
        let matchLength = 0;
        let foundContext = false;
        
        // Check if this line matches the beginning of the change
        for (let j = 0; j < editLines.length && i + j < lines.length; j++) {
          const editLine = editLines[j].trim();
          const originalLine = lines[i + j].trim();
          
          if (editLine === originalLine) {
            score++;
            matchLength = j + 1;
            foundContext = true;
          } else if (editLine.includes('// ... existing code ...')) {
            // Skip the "existing code" marker
            continue;
          } else if (editLine && !editLine.includes('// ... existing code ...')) {
            // This is new content
            changeContent += editLine + '\n';
            if (!foundContext) {
              // This is an addition
              changeType = 'add';
            }
          } else {
            break;
          }
        }
        
        if (score > bestMatch.score) {
          bestMatch = { startLine: i + 1, endLine: i + matchLength, score };
        }
      }
      
      // If we found a good match, determine the change type and content
      if (bestMatch.score > 0) {
        // Extract the actual change content (lines that aren't "existing code")
        const actualChanges = editLines.filter(line => 
          !line.includes('// ... existing code ...') && line.trim()
        );
        
        if (actualChanges.length === 0) {
          changeType = 'delete';
        } else if (bestMatch.score === 1 && actualChanges.length > 0) {
          changeType = 'add';
        } else {
          changeType = 'modify';
        }
        
        changeContent = actualChanges.join('\n');
        
        parsedChanges.push({
          change,
          startLine: bestMatch.startLine,
          endLine: bestMatch.endLine,
          type: changeType,
          content: changeContent
        });
      }
    });

    return parsedChanges;
  };

  // Handle editor mount
  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
    editorRef.current = editor;
    
    // Configure LaTeX language
    monaco.languages.register({ id: 'latex' });
    
    // Basic LaTeX syntax highlighting
    monaco.languages.setMonarchTokensProvider('latex', {
      tokenizer: {
        root: [
          [/\\[a-zA-Z@]+/, 'keyword'],
          [/\\[^a-zA-Z@]/, 'keyword'],
          [/\{/, 'delimiter.bracket', '@bracket'],
          [/\}/, 'delimiter.bracket', '@bracket'],
          [/\[/, 'delimiter.square', '@square'],
          [/\]/, 'delimiter.square', '@square'],
          [/\$/, 'string', '@math'],
          [/%.*$/, 'comment'],
          [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier']
        ],
        bracket: [
          [/\{/, 'delimiter.bracket', '@bracket'],
          [/\}/, 'delimiter.bracket', '@bracket'],
          [/[^{}]+/, 'string']
        ],
        square: [
          [/\[/, 'delimiter.square', '@square'],
          [/\]/, 'delimiter.square', '@square'],
          [/[^\[\]]+/, 'string']
        ],
        math: [
          [/\$/, 'string', '@pop'],
          [/[^$]+/, 'string']
        ]
      }
    });

    // Register commands for apply/reject actions
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, function() {
      const position = editor.getPosition();
      if (!position) return;
      const change = findChangeAtPosition(position);
      if (change) {
        onApplyChange(change.change.id);
      }
    }, 'applyChange');

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Escape, function() {
      const position = editor.getPosition();
      if (!position) return;
      const change = findChangeAtPosition(position);
      if (change) {
        onRejectChange(change.change.id);
      }
    }, 'rejectChange');

    // Register custom hover provider
    const hoverProvider = monaco.languages.registerHoverProvider('latex', {
      provideHover: (model: editor.ITextModel, position: import('monaco-editor').Position) => {
        const parsedChanges = parseChanges(proposedChanges);
        const change = parsedChanges.find(parsed => 
          position.lineNumber >= parsed.startLine && 
          position.lineNumber <= parsed.endLine
        );

        if (!change) {
          return null;
        }

        // Create markdown content with actionable links
        const markdownContent = `**${change.change.description}**

Confidence: ${Math.round(change.change.confidence * 100)}%

**Proposed change:**
\`\`\`latex
${change.content || 'No content changes'}
\`\`\`

**[Apply Change](command:applyChange)** | **[Reject Change](command:rejectChange)**

*Or use Ctrl+Enter to apply, Ctrl+Escape to reject*`;

        return {
          range: new monaco.Range(change.startLine, 1, change.endLine, 1),
          contents: [
            {
              value: markdownContent
            }
          ]
        };
      }
    });

    // Resize editor to fit container
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { height } = entry.contentRect;
        setContainerHeight(height);
        editor.layout();
      }
    });

    const container = editor.getContainerDomNode();
    if (container) {
      resizeObserver.observe(container);
    }

    // Cleanup function
    return () => {
      hoverProvider.dispose();
      resizeObserver.disconnect();
    };
  };

  // Find change at cursor position
  const findChangeAtPosition = (position: { lineNumber: number; column: number }): ParsedChange | null => {
    const parsedChanges = parseChanges(proposedChanges);
    return parsedChanges.find(parsed => 
      position.lineNumber >= parsed.startLine && 
      position.lineNumber <= parsed.endLine
    ) || null;
  };

  // Update decorations when proposed changes change
  useEffect(() => {
    if (!editorRef.current || proposedChanges.length === 0) {
      setDecorations([]);
      return;
    }

    const parsedChanges = parseChanges(proposedChanges);
    const newDecorations = parsedChanges.map(parsed => {
      const { change, startLine, endLine, type } = parsed;
      
      // Create decoration based on change type
      let className = 'change-proposal';
      let glyphClassName = 'change-glyph';
      
      switch (type) {
        case 'add':
          className = 'change-add';
          glyphClassName = 'change-glyph-add';
          break;
        case 'delete':
          className = 'change-delete';
          glyphClassName = 'change-glyph-delete';
          break;
        case 'modify':
          className = 'change-modify';
          glyphClassName = 'change-glyph-modify';
          break;
      }

      return {
        range: {
          startLineNumber: startLine,
          startColumn: 1,
          endLineNumber: endLine,
          endColumn: 1
        },
        options: {
          className,
          glyphMarginClassName: glyphClassName,
          hoverMessage: {
            value: `Hover to see proposed changes`
          },
          marginClassName: 'change-margin'
        }
      };
    });

    const decorationIds = editorRef.current.deltaDecorations(decorations, newDecorations);
    setDecorations(decorationIds);
  }, [proposedChanges, value]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Editor
        height="100%"
        language="latex"
        value={value}
        onChange={(newValue) => onChange(newValue || '')}
        onMount={handleEditorDidMount}
        options={{
          readOnly,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          lineNumbers: 'on',
          lineNumbersMinChars: 3, // Add this - reduces line number column width
          glyphMargin: true,
          folding: true,
          wordWrap: 'on',
          theme: 'vs-dark',
          automaticLayout: true,
          padding: { top: 0, bottom: 0}, // Add left: 0, right: 0
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8
          },
          hover: {
            enabled: true,
            delay: 300
          },
          lineDecorationsWidth: 10, // Add this - reduces decoration gutter width
        }}
      />
      
      {/* Custom CSS for change decorations */}
      <style jsx global>{`
        /* Base change styling */
        .change-proposal {
          background-color: rgba(59, 130, 246, 0.1) !important;
          border-left: 3px solid #3b82f6 !important;
        }
        
        /* Add changes - green */
        .change-add {
          background-color: rgba(34, 197, 94, 0.1) !important;
          border-left: 3px solid #22c55e !important;
        }
        
        /* Delete changes - red */
        .change-delete {
          background-color: rgba(239, 68, 68, 0.1) !important;
          border-left: 3px solid #ef4444 !important;
        }
        
        /* Modify changes - yellow */
        .change-modify {
          background-color: rgba(234, 179, 8, 0.1) !important;
          border-left: 3px solid #eab308 !important;
        }
        
        /* Glyph styling */
        .change-glyph {
          background-color: #3b82f6 !important;
          width: 16px !important;
          height: 16px !important;
          border-radius: 50% !important;
          cursor: pointer !important;
          margin: 2px !important;
        }
        
        .change-glyph-add {
          background-color: #22c55e !important;
        }
        
        .change-glyph-delete {
          background-color: #ef4444 !important;
        }
        
        .change-glyph-modify {
          background-color: #eab308 !important;
        }
        
        .change-glyph:hover {
          transform: scale(1.1) !important;
          transition: transform 0.2s ease !important;
        }
        
        /* Margin styling */
        .change-margin {
          background-color: rgba(59, 130, 246, 0.05) !important;
        }
        
        /* Remove any default margins/padding from Monaco */
        .monaco-editor {
          margin: 0 !important;
          padding: 0 !important;
        }
        
        .monaco-editor .view-lines {
          margin: 0 !important;
        }
      `}</style>
    </div>
  );
}
