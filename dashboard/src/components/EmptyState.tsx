import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void } | { label: string; to: string };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-4 text-gray-600">{icon}</div>}
      <h2 className="mb-2 text-lg font-semibold text-gray-200">{title}</h2>
      <p className="mb-6 max-w-sm text-sm text-gray-500">{description}</p>
      {action &&
        ('to' in action ? (
          <Link
            to={action.to}
            className="rounded-lg bg-orange-400 px-4 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-orange-300"
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="rounded-lg bg-orange-400 px-4 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-orange-300"
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}
