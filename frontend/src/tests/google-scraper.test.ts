import { describe, it, expect, beforeEach } from 'vitest';
import { extractTopUrls } from '@/content/google-scraper';

/** Google検索結果ページを模したDOMを構築するヘルパー */
function buildGoogleDOM(urls: string[]): void {
  document.body.innerHTML = `
    <div id="search">
      ${urls.map((url) => `
        <div class="g">
          <a href="${url}">結果タイトル</a>
        </div>
      `).join('')}
    </div>
  `;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('extractTopUrls — 基本動作', () => {
  it('通常の外部URLを10件まで抽出する', () => {
    buildGoogleDOM([
      'https://site1.com/',
      'https://site2.com/',
      'https://site3.com/',
    ]);
    const urls = extractTopUrls();
    expect(urls).toEqual([
      'https://site1.com/',
      'https://site2.com/',
      'https://site3.com/',
    ]);
  });

  it('limit を超える件数がある場合は上位 limit 件だけ返す', () => {
    const many = Array.from({ length: 15 }, (_, i) => `https://site${i + 1}.com/`);
    buildGoogleDOM(many);
    const urls = extractTopUrls(10);
    expect(urls).toHaveLength(10);
  });

  it('DOMが空の場合は空配列を返す', () => {
    document.body.innerHTML = '<div id="search"></div>';
    expect(extractTopUrls()).toEqual([]);
  });
});

describe('extractTopUrls — フィルタリング', () => {
  it('google.com へのリンクを除外する', () => {
    document.body.innerHTML = `
      <div id="search">
        <div class="g"><a href="https://www.google.com/search?q=test">Google内部</a></div>
        <div class="g"><a href="https://external.com/">外部</a></div>
      </div>
    `;
    const urls = extractTopUrls();
    expect(urls).toEqual(['https://external.com/']);
    expect(urls.some((u) => u.includes('google.com'))).toBe(false);
  });

  it('重複URLを除去して先頭のみ採用する', () => {
    buildGoogleDOM([
      'https://same.com/page',
      'https://same.com/page',
      'https://other.com/',
    ]);
    const urls = extractTopUrls();
    expect(urls).toEqual(['https://same.com/page', 'https://other.com/']);
  });

  it('フラグメント(#)を除去して重複判定する', () => {
    buildGoogleDOM([
      'https://same.com/page#section1',
      'https://same.com/page#section2',
    ]);
    const urls = extractTopUrls();
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe('https://same.com/page');
  });
});

describe('extractTopUrls — /url?q= リダイレクト展開', () => {
  it('/url?q=... 形式のリダイレクトを実際のURLに展開する', () => {
    document.body.innerHTML = `
      <div id="search">
        <div class="g">
          <a href="/url?q=https://real-destination.com/&sa=U">リダイレクト</a>
        </div>
      </div>
    `;
    const urls = extractTopUrls();
    expect(urls).toEqual(['https://real-destination.com/']);
  });
});
