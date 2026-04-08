import { fetchAnalyze, fetchAnalyzeMock } from '@/utils/api';
import { getState, setState } from '@/utils/storage';
import type { RuntimeMessage } from '@/types/messages';

const callApi = import.meta.env.VITE_USE_MOCK === 'true' ? fetchAnalyzeMock : fetchAnalyze;

let pendingGoogleTabId: number | null = null;

// 拡張機能がインストールされた際にこのファイルが実行され、chrome.runtime.onMessage.addListener が呼び出され、
// Chrome内部のイベントシステム（メッセージングのレジストリのようなもの）にコールバックが登録される。
// で、メッセージが実際に発生した時には、このファイル全体が再度読み直され、コールバック関数が作られ、実行される。
// 引数の型について、第一引数以外の引数の型は、TypeScriptが裏で型を当てはめてくれているので必要ない
chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === 'ANALYZE_START') {
    handleAnalyze().catch(async (err) => {
      console.error(err);
      await setState({ status: 'error', error: String(err?.message ?? err) });
    });
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'GOOGLE_RESULTS') {
    handleGoogleResults(message.urls).catch(console.error);
    sendResponse({ ok: true });
    return true;
  }
});


export async function handleAnalyze(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    await setState({ status: 'error', error: 'アクティブタブを取得できませんでした' });
    return;
  }
  if (!/^https?:/.test(tab.url)) {
    await setState({ status: 'error', error: 'このページは分析できません' });
    return;
  }

  const domain = new URL(tab.url).origin;

  await setState({
    status: 'analyzing',
    domain,
    data: undefined,
    urls: undefined,
    error: undefined,
  });

  const data = await callApi(domain);

  await setState({ status: 'searching', data });

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(data.search_query)}`;
  const newTab = await chrome.tabs.create({ url: searchUrl, active: true });
  pendingGoogleTabId = newTab.id ?? null;

  // 安全策: 15秒以内に結果が来なければエラー
  setTimeout(async () => {
    const s = await getState();
    if (s.status === 'searching') {
      await setState({ status: 'error', error: 'Google検索結果の取得がタイムアウトしました' });
    }
  }, 15000);
}

export async function handleGoogleResults(urls: string[]): Promise<void> {
  if (!urls.length) {
    await setState({ status: 'error', error: '検索結果からURLを取得できませんでした' });
    return;
  }
  await setState({ status: 'done', urls: urls.slice(0, 10) });

  if (pendingGoogleTabId !== null) {
    pendingGoogleTabId = null;
  }
}
