import { useState } from 'react';
import { screenshotUrl } from '../lib/api';

interface Props {
  sessionId: string;
  stepId: string;
}

export default function ScreenshotViewer({ sessionId, stepId }: Props) {
  const [open, setOpen] = useState(false);
  const url = screenshotUrl(sessionId, stepId);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-orange-400 hover:text-orange-300 text-xs underline"
      >
        View
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-w-5xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={url}
              alt={`Screenshot for step ${stepId}`}
              className="rounded-lg border border-gray-700"
              loading="lazy"
            />
          </div>
        </div>
      )}
    </>
  );
}
