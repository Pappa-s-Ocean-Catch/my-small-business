import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'elevated' | 'outlined';
  hover?: boolean;
}

export default function Card({ 
  children, 
  className = '',
  padding = 'md',
  variant = 'default',
  hover = false
}: CardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };

  const variantClasses = {
    default: 'bg-white/60 dark:bg-black/20 shadow-lg',
    elevated: 'bg-white dark:bg-neutral-900 shadow-xl',
    outlined: 'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800'
  };

  const hoverClasses = hover ? 'hover:shadow-xl transition-shadow duration-200' : '';

  return (
    <div 
      className={`
        rounded-lg 
        ${variantClasses[variant]} 
        ${paddingClasses[padding]} 
        ${hoverClasses} 
        ${className}
      `.trim()}
    >
      {children}
    </div>
  );
}
