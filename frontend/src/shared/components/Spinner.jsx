import { cn } from '@shared/utils/cn';

export default function Spinner({ size = 'md', className }) {
  const sizeClass = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-border border-t-primary',
        sizeClass[size],
        className
      )}
    />
  );
}
