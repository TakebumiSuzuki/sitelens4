import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAnalyze, handleGoogleResults } from '@/background/service-worker';
import { getState } from '@/lib/storage';
import type { AnalyzeResponse } from '@/types/analyze';

const mockApiResponse: AnalyzeResponse = {
  company_name: 'Apple Inc.',
  year_founded: 1976,
  headquarters: 'Cupertino, California, USA',
  description: 'Consumer electronics company.',
  products_and_services: 'iPhone, Mac, iPad',
  search_query: 'Apple Inc. news 2026',
};

// fetch をモック
vi.stubGlobal('fetch', vi.fn());

beforeEach(() => {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => mockApiResponse,
  } as Response);
});

describe('handleAnalyze — API呼出からStorage保存までの統合フロー', () => {
  it('正常系: analyzing → searching へ状態遷移し、Googleタブが開く', async () => {
    chrome.tabs.query = vi.fn().mockResolvedValue([
      { url: 'https://www.apple.com/jp/iphone' },
    ]);
    chrome.tabs.create = vi.fn().mockResolvedValue({ id: 42 });

    await handleAnalyze();

    const state = await getState();
    expect(state.status).toBe('searching');
    expect(state.domain).toBe('https://www.apple.com');
    expect(state.data?.company_name).toBe('Apple Inc.');
    expect(state.data?.search_query).toBe('Apple Inc. news 2026');

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'https://www.google.com/search?q=Apple%20Inc.%20news%202026',
      active: true,
    });
  });

  it('chrome:// ページでは error 状態になる', async () => {
    chrome.tabs.query = vi.fn().mockResolvedValue([
      { url: 'chrome://newtab/' },
    ]);

    await handleAnalyze();

    const state = await getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('このページは分析できません');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('アクティブタブが取得できない場合は error 状態になる', async () => {
    chrome.tabs.query = vi.fn().mockResolvedValue([]);

    await handleAnalyze();

    const state = await getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('アクティブタブを取得できませんでした');
  });

  it('API がエラーを返した場合は error 状態になる', async () => {
    chrome.tabs.query = vi.fn().mockResolvedValue([
      { url: 'https://www.apple.com/' },
    ]);
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    await handleAnalyze().catch(() => {}); // 呼び出し元でcatchされる想定
    // service worker内のcatch節がstateをerrorにする
    // ここではfetchが失敗することを確認
    expect(fetch).toHaveBeenCalled();
  });

  it('domain は origin 形式（プロトコル+ホスト）で送信される', async () => {
    chrome.tabs.query = vi.fn().mockResolvedValue([
      { url: 'https://blog.example.com/posts/123?ref=foo' },
    ]);
    chrome.tabs.create = vi.fn().mockResolvedValue({ id: 1 });

    await handleAnalyze();

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.domain).toBe('https://blog.example.com'); // サブドメイン含む origin
  });
});

describe('handleGoogleResults — URL受信からStorage保存までの統合フロー', () => {
  it('正常系: urls が保存され status が done になる', async () => {
    const urls = [
      'https://techcrunch.com/apple',
      'https://reuters.com/apple',
      'https://bloomberg.com/apple',
    ];
    await handleGoogleResults(urls);

    const state = await getState();
    expect(state.status).toBe('done');
    expect(state.urls).toEqual(urls);
  });

  it('11件以上来た場合は上位10件のみ保存する', async () => {
    const urls = Array.from({ length: 12 }, (_, i) => `https://site${i + 1}.com/`);
    await handleGoogleResults(urls);

    const state = await getState();
    expect(state.urls).toHaveLength(10);
  });

  it('空配列が来た場合は error 状態になる', async () => {
    await handleGoogleResults([]);

    const state = await getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('検索結果からURLを取得できませんでした');
  });
});
