export type RuntimeMessage =
  | { type: 'ANALYZE_START' }
  | { type: 'GOOGLE_RESULTS'; urls: string[] }
  | { type: 'STATE_UPDATED' };
