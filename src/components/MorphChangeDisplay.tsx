'use client';

import { ProposedChange } from '@/lib/morph-types';

interface MorphChangeDisplayProps {
  change: ProposedChange;
  onApply: (changeId: string) => void;
  onReject: (changeId: string) => void;
  isApplying?: boolean;
}

export default function MorphChangeDisplay({ 
  change, 
  onApply, 
  onReject, 
  isApplying = false 
}: MorphChangeDisplayProps) {
  return (
    <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3 bg-blue-50 dark:bg-blue-900/20">
      {/* Change Description */}
      <div className="mb-2">
        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
          {change.description}
        </h4>
        <div className="text-xs text-blue-600 dark:text-blue-400">
          Confidence: {Math.round(change.confidence * 100)}%
        </div>
      </div>

      {/* Code Preview */}
      <div className="mb-3">
        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Preview:</div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-xs font-mono text-gray-800 dark:text-gray-200 max-h-32 overflow-y-auto">
          <pre className="whitespace-pre-wrap">{change.codeEdit}</pre>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onApply(change.id)}
          disabled={isApplying}
          className="px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors"
        >
          {isApplying ? 'Applying...' : 'Apply'}
        </button>
        <button
          onClick={() => onReject(change.id)}
          disabled={isApplying}
          className="px-3 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
