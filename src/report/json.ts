import type { ReportData } from '../types/index.js';

export async function generate(
  data: ReportData,
  _screenshotResolver: (stepId: string) => Promise<string | null>,
): Promise<string> {
  const cleanSession = {
    ...data.session,
    steps: data.session.steps.map(({ screenshot: _, ...rest }) => rest),
  };

  return JSON.stringify(
    {
      ...data,
      session: cleanSession,
    },
    null,
    2,
  );
}
