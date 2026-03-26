import React from "react";

interface SpecialInstructionsProps {
  paymentMethod: string | null;
  specialInstructions: string;
  setSpecialInstructions: (val: string) => void;
}

export function SpecialInstructions({
  paymentMethod,
  specialInstructions,
  setSpecialInstructions,
}: SpecialInstructionsProps) {
  if (!paymentMethod) return null;

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Special Instructions (Optional)
      </h2>
      <textarea
        value={specialInstructions}
        onChange={(e) => setSpecialInstructions(e.target.value)}
        rows={4}
        maxLength={500}
        className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white resize-none"
        placeholder="Any special instructions for your order..."
      />
    </div>
  );
}
