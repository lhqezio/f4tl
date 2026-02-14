import { useState, useEffect, useRef } from 'react';
import { screenshotUrl } from '../lib/api';

interface Props {
  sessionId: string;
  stepId: string;
}

export default function ScreenshotViewer({ sessionId, stepId }: Props) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const url = screenshotUrl(sessionId, stepId);

  // Focus trap + escape handler
  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
      // Simple focus trap: keep focus on close button
      if (e.key === 'Tab') {
        e.preventDefault();
        closeRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-orange-400 underline hover:text-orange-300"
      >
        View
      </button>

      {open && (
        <div
          className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`Screenshot for step ${stepId}`}
          onClick={() => setOpen(false)}
        >
          <div
            className="relative max-h-[90vh] max-w-5xl overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={closeRef}
              onClick={() => setOpen(false)}
              aria-label="Close screenshot"
              className="absolute -right-2 -top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-gray-400 shadow-lg transition-colors hover:bg-gray-700 hover:text-gray-200"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <img
              src={url}
              alt={`Screenshot for step ${stepId}`}
              className="rounded-lg border border-gray-700"
            />
          </div>
        </div>
      )}
    </>
  );
}
