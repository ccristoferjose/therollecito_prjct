import { cn } from '@shared/utils/cn';

const variants = {
  primary: 'bg-primary text-text-inverse hover:bg-accent-hover shadow-[var(--shadow-warm)]',
  accent: 'bg-accent text-primary-dark hover:bg-accent-hover hover:text-text-inverse shadow-[var(--shadow-warm)]',
  outline: 'border-2 border-primary-dark text-primary-dark hover:bg-primary-dark hover:text-text-inverse',
  ghost: 'text-primary-dark hover:bg-primary-light/60',
  danger: 'bg-error text-text-inverse hover:bg-accent-hover',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-7 py-3.5 text-base',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  ...props
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
