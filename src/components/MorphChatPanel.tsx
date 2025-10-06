'use client';

import { ChatMessage } from '@/lib/morph-types';
import MorphProposalPanel from './MorphProposalPanel';
import { ProposedChange } from '@/lib/morph-types';

interface MorphChatPanelProps {
  chatMessages: ChatMessage[];
  proposedChanges: ProposedChange[];
  isProcessing: boolean;
  onSendMessage: (message: string) => void;
  onApplyChange: (changeId: string) => void;
  onRejectChange: (changeId: string) => void;
  onApplyAll: () => void;
  onRejectAll: () => void;
}

export default function MorphChatPanel({
  chatMessages,
  proposedChanges,
  isProcessing,
  onSendMessage,
  onApplyChange,
  onRejectChange,
  onApplyAll,
  onRejectAll
}: MorphChatPanelProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const message = formData.get('message') as string;
    
    if (message.trim()) {
      onSendMessage(message.trim());
      e.currentTarget.reset();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Messages Area */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="space-y-3">
          {chatMessages.map((message) => (
            <div
              key={message.id}
              className={`p-3 rounded-lg ${
                message.type === 'user'
                  ? 'bg-blue-600 text-white ml-8'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white mr-8'
              }`}
            >
              <p className="text-sm">{message.content}</p>
              <p className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          ))}
          
          {isProcessing && (
            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg mr-8">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <p className="text-sm text-gray-600 dark:text-gray-400">AI is thinking...</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Proposed Changes Panel */}
      <MorphProposalPanel
        changes={proposedChanges}
        onApplyChange={onApplyChange}
        onRejectChange={onRejectChange}
        onApplyAll={onApplyAll}
        onRejectAll={onRejectAll}
        isProcessing={isProcessing}
      />
      
      {/* Chat Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            name="message"
            type="text"
            placeholder="Ask me to help with your LaTeX..."
            disabled={isProcessing}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button 
            type="submit"
            disabled={isProcessing}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
