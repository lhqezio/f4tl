export const GLOSSARY: Record<string, string> = {
  context:
    'An isolated browser session — like separate browser profiles for different users (e.g. buyer, seller)',
  actors:
    'The different user roles being tested at the same time (e.g. a buyer and a seller in the same app)',
  fingerprint:
    'A unique ID for a bug, used to track if the same bug shows up again across test runs',
  severity:
    'How bad the bug is: critical = data loss, major = broken feature, minor = small issue, cosmetic = visual only',
  findings:
    'Non-bug observations: usability issues, performance notes, accessibility gaps, suggestions',
  steps:
    'Individual actions taken during testing — each click, navigation, or form fill is one step',
  session: 'A single test run from start to finish, containing all steps, bugs, and findings',
};
