import { cn } from '@shared/utils/cn';

const colorMap = {
  CREATED: 'bg-gray-100 text-gray-700',
  PAID: 'bg-blue-50 text-blue-700',
  PREPARING: 'bg-amber-50 text-amber-700',
  READY: 'bg-green-50 text-green-700',
  COMPLETED: 'bg-primary-light text-primary-dark',
  default: 'bg-gray-100 text-text-secondary',
};

export default function Badge({ children, status, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        colorMap[status] || colorMap.default,
        className
      )}
    >
      {children}
    </span>
  );
}
