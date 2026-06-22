import { cn } from '@/lib/utils/cn';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClass = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' } as const;
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-border border-t-primary',
        sizeClass[size],
        className,
      )}
    />
  );
}
