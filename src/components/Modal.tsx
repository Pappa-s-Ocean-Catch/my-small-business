import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  bodyClassName?: string;
}

export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer,
  size = 'lg',
  className = '',
  bodyClassName = ''
}: ModalProps) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg', 
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50" onClick={onClose}>
      <div 
        className={`w-full ${sizeClasses[size]} bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl p-0 max-h-[85vh] overflow-hidden ${className}`} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button 
            type="button" 
            onClick={onClose} 
            className="h-8 w-8 rounded-lg inline-grid place-items-center hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="size-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        
        {/* Modal Body */}
        <div className={`max-h-[calc(85vh-80px)] overflow-y-auto overflow-x-hidden ${bodyClassName}`}>
          {children}
        </div>
        
        {/* Modal Footer */}
        {footer && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
