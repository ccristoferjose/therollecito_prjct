import type { ComponentType, ReactNode } from 'react';

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
  'aria-hidden'?: boolean | 'true' | 'false';
}

interface EmptyStateProps {
  icon?: ComponentType<IconProps>;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /**
   * Heading level for the title. Defaults to h2 because an empty state almost
   * always sits directly under the page's h1; the old fixed h3 skipped a level.
   */
  headingLevel?: 2 | 3 | 4;
}

export default function EmptyState({ icon: Icon, title, description, action, headingLevel = 2 }: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon size={48} className="text-border mb-4" strokeWidth={1.5} aria-hidden="true" />}
      <Heading className="text-lg font-medium text-text">{title}</Heading>
      {description && <p className="mt-1 text-sm text-text-secondary max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
