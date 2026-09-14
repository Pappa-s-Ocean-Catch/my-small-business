import React from 'react';
import { FaTimes } from 'react-icons/fa';

type Props = {
  open: boolean;
  onClose: () => void;
  subject: string;
  htmlBody: string;
};

export default function EmailPreviewModal({ open, onClose, subject, htmlBody }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-neutral-900 rounded-lg w-full max-w-3xl p-6 shadow-xl relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
        >
          <FaTimes size={20} />
        </button>
        <h2 className="text-xl font-semibold mb-4">Email Preview</h2>
        <h3 className="font-medium mb-2">{subject}</h3>
        <div
          className="prose dark:prose-invert max-h-96 overflow-y-auto border rounded p-4"
          dangerouslySetInnerHTML={{ __html: htmlBody }}
        />
      </div>
    </div>
  );
}
