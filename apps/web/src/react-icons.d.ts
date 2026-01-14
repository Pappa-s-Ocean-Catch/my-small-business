// Type declaration to fix react-icons className prop compatibility with React 19
// This allows className prop on all react-icons components

declare module 'react-icons/fa' {
  import { FC, SVGProps } from 'react';
  
  type IconProps = SVGProps<SVGSVGElement> & {
    className?: string;
  };
  
  // Re-export all icons with the correct type
  export const FaPlay: FC<IconProps>;
  export const FaCheckCircle: FC<IconProps>;
  export const FaUtensils: FC<IconProps>;
  export const FaArrowRight: FC<IconProps>;
  export const FaPhone: FC<IconProps>;
  export const FaClock: FC<IconProps>;
  export const FaEnvelope: FC<IconProps>;
  // Add all other icons used in the codebase...
}

// For a more comprehensive fix, we can use a global type augmentation
// but that requires knowing all icon names. The above approach works for specific icons.
