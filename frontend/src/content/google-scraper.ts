const SELECTORS = [
  'div#search div.g a[href]',
  'a[jsname][href^="http"]',
  'div[data-sokoban-container] a[href^="http"]',
];

export function extractTopUrls(limit = 10): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const selector of SELECTORS) {
    const anchors = document.querySelectorAll<HTMLAnchorElement>(selector);
    for (const a of anchors) {
      let href = a.href;
      if (!href) continue;

      // /url?q=... 形式のリダイレクトを展開
      try {
        // URLはブラウザ標準のWeb API（Node.jsにも組み込み）で、URLを構造的にパースするクラス
        const u = new URL(href, location.href);
        if (u.pathname === '/url' && u.searchParams.get('q')) {
          href = u.searchParams.get('q')!;
        }
      } catch {
        continue;
      }

      // フィルタ: 内部リンク・google.com への遷移は除外
      if (!/^https?:\/\//.test(href)) continue;
      if (/^https?:\/\/(www\.)?google\.[^/]+\//.test(href)) continue;
      if (href.startsWith('#')) continue;

      // 同一URLの重複は除去（先頭のみ採用）
      const key = href.split('#')[0];
      if (seen.has(key)) continue;
      seen.add(key);
      urls.push(key);

      if (urls.length >= limit) return urls;
    }
    if (urls.length >= limit) return urls;
  }
  return urls;
}

function send(urls: string[]): void {
  chrome.runtime.sendMessage({ type: 'GOOGLE_RESULTS', urls });
}

// document_idle で実行されるが、結果が遅延描画される場合に備えてリトライする
const tryExtract = (attempt = 0) => {
  const urls = extractTopUrls();
  if (urls.length > 0 || attempt >= 5) {
    send(urls);
    return;
  }
  setTimeout(() => tryExtract(attempt + 1), 500);
};

tryExtract();
