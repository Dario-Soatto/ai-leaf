'use client';

import { ProposedChange } from '@/lib/morph-types';
import MorphChangeDisplay from './MorphChangeDisplay';

interface MorphProposalPanelProps {
  changes: ProposedChange[];
  onApplyChange: (changeId: string) => void;
  onRejectChange: (changeId: string) => void;
  onApplyAll: () => void;
  onRejectAll: () => void;
  isProcessing?: boolean;
  applyingChangeId?: string | null;
  isApplyingAll?: boolean;
}

export default function MorphProposalPanel({
  changes,
  onApplyChange,
  onRejectChange,
  onApplyAll,
  onRejectAll,
  isProcessing = false,
  applyingChangeId = null,
  isApplyingAll = false
}: MorphProposalPanelProps) {
  if (changes.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
          Proposed Changes ({changes.length})
        </h3>
        
        <div className="flex gap-2 mb-3">
          <button
            onClick={onApplyAll}
            disabled={isProcessing || isApplyingAll || applyingChangeId !== null}
            className="px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors"
          >
            {isApplyingAll ? 'Applying...' : 'Apply All'}
          </button>
          <button
            onClick={onRejectAll}
            disabled={isProcessing || isApplyingAll || applyingChangeId !== null}
            className="px-3 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors"
          >
            Reject All
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {changes.map((change) => (
          <MorphChangeDisplay
            key={change.id}
            change={change}
            onApply={onApplyChange}
            onReject={onRejectChange}
            isApplying={applyingChangeId === change.id}
            disabled={applyingChangeId !== null && applyingChangeId !== change.id}
          />
        ))}
      </div>
    </div>
  );
}
