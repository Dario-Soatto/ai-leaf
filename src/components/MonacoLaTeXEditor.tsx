'use client';

import { useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { ProposedChange } from '@/lib/morph-types';

interface MonacoLaTeXEditorProps {
  value: string;
  onChange: (value: string) => void;
  proposedChanges: ProposedChange[];
  onApplyChange: (changeId: string) => void;
  onRejectChange: (changeId: string) => void;
  readOnly?: boolean;
}

export default function MonacoLaTeXEditor({
  value,
  onChange,
  proposedChanges,
  onApplyChange,
  onRejectChange,
  readOnly = false
}: MonacoLaTeXEditorProps) {
  const editorRef = useRef<any>(null);
  const [decorations, setDecorations] = useState<string[]>([]);
  const [containerHeight, setContainerHeight] = useState(400);

  // Handle editor mount
  const handleEditorDidMount = (editor: any, monaco: any) => {
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

    // Add custom actions for apply/reject
    editor.addAction({
      id: 'apply-change',
      label: 'Apply Change',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: (editor: any) => {
        const position = editor.getPosition();
        const change = findChangeAtPosition(position);
        if (change) {
          onApplyChange(change.id);
        }
      }
    });

    editor.addAction({
      id: 'reject-change',
      label: 'Reject Change',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Escape],
      run: (editor: any) => {
        const position = editor.getPosition();
        const change = findChangeAtPosition(position);
        if (change) {
          onRejectChange(change.id);
        }
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
  };

  // Find change at cursor position
  const findChangeAtPosition = (position: any) => {
    // This is a simplified version - we'll need to parse the changes
    // to find which one is at the current position
    return proposedChanges.find(change => {
      // For now, return the first change
      // We'll improve this logic later
      return true;
    });
  };

  // Update decorations when proposed changes change
  useEffect(() => {
    if (!editorRef.current) return;

    const newDecorations = proposedChanges.map((change, index) => {
      // Parse the change to find line numbers
      // This is a simplified version - we'll need to parse the actual change
      const startLine = 1 + index; // Placeholder logic
      const endLine = startLine + 1;

      return {
        range: {
          startLineNumber: startLine,
          startColumn: 1,
          endLineNumber: endLine,
          endColumn: 1
        },
        options: {
          className: 'change-proposal',
          glyphMarginClassName: 'change-glyph',
          hoverMessage: {
            value: change.description
          }
        }
      };
    });

    const decorationIds = editorRef.current.deltaDecorations(decorations, newDecorations);
    setDecorations(decorationIds);
  }, [proposedChanges]);

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
          glyphMargin: true,
          folding: true,
          wordWrap: 'on',
          theme: 'vs-dark',
          automaticLayout: true,
          padding: { top: 0, bottom: 0 },
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8
          }
        }}
      />
      
      {/* Custom CSS for change decorations */}
      <style jsx global>{`
        .change-proposal {
          background-color: rgba(59, 130, 246, 0.1) !important;
          border-left: 3px solid #3b82f6 !important;
        }
        
        .change-glyph {
          background-color: #3b82f6 !important;
          width: 20px !important;
          height: 20px !important;
          border-radius: 50% !important;
          cursor: pointer !important;
        }
        
        .change-glyph:hover {
          background-color: #2563eb !important;
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
