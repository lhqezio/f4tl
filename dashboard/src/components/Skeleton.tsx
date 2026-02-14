interface SkeletonProps {
  className?: string;
}

function Shimmer({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse rounded bg-gray-800 ${className}`} />;
}

export function SkeletonText({ className = '' }: SkeletonProps) {
  return <Shimmer className={`h-4 w-3/4 ${className}`} />;
}

export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div className={`rounded-lg border border-gray-800 bg-gray-900 p-5 ${className}`}>
      <Shimmer className="mb-3 h-4 w-1/3" />
      <Shimmer className="mb-2 h-3 w-full" />
      <Shimmer className="h-3 w-2/3" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, className = '' }: SkeletonProps & { rows?: number }) {
  return (
    <div className={`space-y-3 ${className}`}>
      <Shimmer className="h-8 w-full" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-4">
          <Shimmer className="h-6 w-24" />
          <Shimmer className="h-6 w-16" />
          <Shimmer className="h-6 flex-1" />
          <Shimmer className="h-6 w-12" />
          <Shimmer className="h-6 w-10" />
        </div>
      ))}
    </div>
  );
}
