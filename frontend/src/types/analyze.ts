export interface AnalyzeResponse {
  company_name: string;
  year_founded: string | number;
  headquarters: string;
  description: string;
  products_and_services: string;
  search_query: string;
  [key: string]: unknown;
}

export type AnalysisStatus =
  | 'idle'
  | 'analyzing'
  | 'searching'
  | 'done'
  | 'error';

export interface StoredState {
  status: AnalysisStatus;
  domain?: string;
  data?: AnalyzeResponse;
  urls?: string[];
  error?: string;
  updatedAt: number;
}
