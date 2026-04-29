import { cn } from '@shared/utils/cn';

export default function Card({ children, className, padding = true, ...props }) {
  return (
    <div
      className={cn(
        'bg-surface rounded-2xl border border-border/60 shadow-[var(--shadow-card)]',
        padding && 'p-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
