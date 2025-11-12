import { useState, useCallback } from 'react';

export function usePDFCompiler(documentId?: string) {  // Add documentId parameter
  const [isCompiling, setIsCompiling] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);

  const compileLatex = useCallback(async (
    latexCode: string, 
    fileSnapshots?: Array<{filename: string; content: string; is_main: boolean; file_type: string}>
  ) => {
    if (!latexCode.trim()) {
      setCompileError('Please enter some LaTeX code to compile');
      return;
    }

    setIsCompiling(true);
    setCompileError(null);
    setPdfUrl(null);

    try {
      const response = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          latex: latexCode,
          documentId: documentId,  // Pass documentId
          fileSnapshots: fileSnapshots  // Pass snapshots if provided
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Compilation failed');
      }

      const pdfBlob = await response.blob();
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);

    } catch (error) {
      console.error('Compilation error:', error);
      setCompileError(error instanceof Error ? error.message : 'Compilation failed');
    } finally {
      setIsCompiling(false);
    }
  }, [documentId]);  // Add to dependencies

  const cleanupPdfUrl = useCallback(() => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
  }, [pdfUrl]);

  return {
    isCompiling,
    pdfUrl,
    compileError,
    compileLatex,
    cleanupPdfUrl,
    setPdfUrl,
    setCompileError
  };
}