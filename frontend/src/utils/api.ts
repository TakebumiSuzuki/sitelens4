import type { AnalyzeResponse } from '@/types/analyze';

export async function fetchAnalyze(domain: string): Promise<AnalyzeResponse> {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (!base) throw new Error('VITE_API_BASE_URL is not set');

  const res = await fetch(`${base}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // この部分は実質的に、{"domain":"https://apple.com"} のような JSON を送ることを意図している。
    body: JSON.stringify({ domain }),
  });
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// 開発用モック: バックエンド未実装時はこちらを使う
// 本番接続時は上の fetchAnalyze だけ残してこのブロックごと削除する
// ---------------------------------------------------------------------------
export async function fetchAnalyzeMock(domain: string): Promise<AnalyzeResponse> {
  await new Promise((r) => setTimeout(r, 500));
  const hostname = new URL(domain).hostname;
  return {
    company_name: 'Apple Inc.',
    year_founded: 1976,
    headquarters: 'Cupertino, California, USA',
    description: 'Designs, manufactures, and markets consumer electronics and software.',
    products_and_services: 'iPhone, Mac, iPad, Apple Watch, Services',
    search_query: `site:${hostname} products`,
  };
}
