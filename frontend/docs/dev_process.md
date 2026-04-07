# SiteLens4 Frontend - 開発手順書

このドキュメントは `docs/app_idea.md` のアプリ仕様をもとに、Chrome拡張機能を一から構築するための詳細な手順をまとめたものです。各ステップにはコマンド、生成すべきファイルのコード例、確認方法（チェックポイント）、ハマりどころを記載しています。

作業ディレクトリは常に `/Users/takebumi/Documents/Python_Codes/SiteLens4/frontend` を前提とします。

---

## ステップ 0: 前提条件の確認

以下がインストール済みであることを確認します。

```bash
node --version   # v20.x 以上を推奨（v18 LTS でも可）
npm --version    # 10.x 以上
```

**チェックポイント**: Node.js 18 未満の場合、Vite 5 が動作しません。`nvm install 20 && nvm use 20` でアップデートしてください。

---

## ステップ 1: プロジェクト初期化

### 1-1. `package.json` の作成

```bash
cd /Users/takebumi/Documents/Python_Codes/SiteLens4/frontend
npm init -y
```

### 1-2. 依存パッケージのインストール

ランタイム依存:

```bash
npm install vue
```

開発依存（ビルド・型・スタイル系）:

```bash
npm install -D vite@^5 @vitejs/plugin-vue @crxjs/vite-plugin@^2.0.0-beta.25 \
  typescript@^5 vue-tsc @types/chrome @types/node \
  tailwindcss@^3 postcss autoprefixer
```

> **注意**: `@crxjs/vite-plugin` は Vite 5 対応のため beta 版（`2.0.0-beta.x`）が安定です。stable 1.x は Vite 4 までしか対応していません。

### 1-3. `package.json` の `scripts` を編集

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview"
  }
}
```

### 1-4. `.gitignore` を作成

```
node_modules
dist
.env
.DS_Store
*.log
```

**チェックポイント**: `node_modules/` が生成され、`npm ls vue vite @crxjs/vite-plugin` がエラーなく表示されることを確認。

---

## ステップ 2: TypeScript 設定

### 2-1. `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["chrome", "vite/client"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 2-2. `tsconfig.node.json`

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["vite.config.ts", "src/manifest.ts"]
}
```

**ハマりどころ**: `moduleResolution` を `node` にすると `@crxjs/vite-plugin` の型解決に失敗します。必ず `bundler` を使ってください。

---

## ステップ 3: Tailwind CSS 設定

### 3-1. 初期化

```bash
npx tailwindcss init -p
```

`tailwind.config.js` と `postcss.config.js` が生成されます。

### 3-2. `tailwind.config.js` を編集

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{vue,ts,html}',
  ],
  theme: { extend: {} },
  plugins: [],
};
```

> `tailwind.config.js` の冒頭に `module.exports = {}` がある場合は `export default {}` に書き換える（ESM統一のため）。

### 3-3. `postcss.config.js` を確認

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**チェックポイント**: 後ほど popup ビルド時に Tailwind のクラスが効いていることを確認します。

---

## ステップ 4: 環境変数の準備

### 4-1. `.env.example`

```
VITE_API_BASE_URL=http://localhost:8000
```

### 4-2. `.env`（実際の開発用、`.gitignore` 済み）

```
VITE_API_BASE_URL=http://localhost:8000
```

**チェックポイント**: `import.meta.env.VITE_API_BASE_URL` がコード内で読めるようになります。`VITE_` プレフィックスは必須です。

---

## ステップ 5: Manifest と Vite 設定

### 5-1. `src/manifest.ts`

```ts
import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'SiteLens',
  description: 'Analyze the current site and find related search results',
  version: '0.1.0',
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'SiteLens',
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  permissions: ['tabs', 'storage', 'activeTab', 'scripting'],
  host_permissions: [
    'https://www.google.com/*',
    'http://localhost/*',
  ],
  content_scripts: [
    {
      matches: ['https://www.google.com/search*'],
      js: ['src/content/google-scraper.ts'],
      run_at: 'document_idle',
    },
  ],
});
```

### 5-2. `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { crx } from '@crxjs/vite-plugin';
import path from 'node:path';
import manifest from './src/manifest';

export default defineConfig({
  plugins: [vue(), crx({ manifest })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        popup: 'src/popup/index.html',
      },
    },
  },
});
```

**ハマりどころ**: CRXJS は manifest 内で参照されたファイル（popup html, service worker, content scripts）を自動でエントリポイントとして拾うので、`rollupOptions.input` を細かく書く必要はありません。上記は明示している例ですが、省略してもOKです。

---

## ステップ 6: 型定義と共有ライブラリ

### 6-1. `src/types/analyze.ts`

```ts
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
```

### 6-2. `src/lib/messages.ts`

```ts
export type RuntimeMessage =
  | { type: 'ANALYZE_START' }
  | { type: 'GOOGLE_RESULTS'; urls: string[] }
  | { type: 'STATE_UPDATED' };
```

### 6-3. `src/lib/storage.ts`

```ts
import type { StoredState } from '@/types/analyze';

const KEY = 'sitelens.state';

export async function getState(): Promise<StoredState> {
  const result = await chrome.storage.local.get(KEY);
  return (
    (result[KEY] as StoredState) ?? {
      status: 'idle',
      updatedAt: Date.now(),
    }
  );
}

export async function setState(patch: Partial<StoredState>): Promise<StoredState> {
  const current = await getState();
  const next: StoredState = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

export function subscribe(cb: (state: StoredState) => void): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
    if (changes[KEY]) {
      cb(changes[KEY].newValue as StoredState);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
```

### 6-4. `src/lib/api.ts`

```ts
import type { AnalyzeResponse } from '@/types/analyze';

export async function fetchAnalyze(domain: string): Promise<AnalyzeResponse> {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (!base) throw new Error('VITE_API_BASE_URL is not set');

  const res = await fetch(`${base}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain }),
  });
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
```

**チェックポイント**: ここまでで `npx vue-tsc --noEmit` を実行し、型エラーがないことを確認。

---

## ステップ 7: Service Worker（バックグラウンド処理）

`src/background/service-worker.ts`:

```ts
import { fetchAnalyze } from '@/lib/api';
import { getState, setState } from '@/lib/storage';
import type { RuntimeMessage } from '@/lib/messages';

let pendingGoogleTabId: number | null = null;

chrome.runtime.onMessage.addListener((msg: RuntimeMessage, _sender, sendResponse) => {
  if (msg.type === 'ANALYZE_START') {
    handleAnalyze().catch(async (err) => {
      console.error(err);
      await setState({ status: 'error', error: String(err?.message ?? err) });
    });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'GOOGLE_RESULTS') {
    handleGoogleResults(msg.urls).catch(console.error);
    sendResponse({ ok: true });
    return true;
  }
});

async function handleAnalyze(): Promise<void> {
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

  const data = await fetchAnalyze(domain);

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

async function handleGoogleResults(urls: string[]): Promise<void> {
  if (!urls.length) {
    await setState({ status: 'error', error: '検索結果からURLを取得できませんでした' });
    return;
  }
  await setState({ status: 'done', urls: urls.slice(0, 10) });

  if (pendingGoogleTabId !== null) {
    // 必要に応じて検索タブを閉じる場合は以下を有効化
    // chrome.tabs.remove(pendingGoogleTabId).catch(() => {});
    pendingGoogleTabId = null;
  }
}
```

**ハマりどころ**:
- service worker は 30 秒程度のアイドルで停止する。`chrome.storage.local` を信頼の置けるソースとして使うこと。
- `onMessage` リスナで `return true` を返さないと非同期 `sendResponse` が無効になる。

---

## ステップ 8: Content Script（Google結果ページのスクレイピング）

`src/content/google-scraper.ts`:

```ts
const SELECTORS = [
  'div#search div.g a[href]',
  'a[jsname][href^="http"]',
  'div[data-sokoban-container] a[href^="http"]',
];

function extractTopUrls(limit = 10): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const selector of SELECTORS) {
    const anchors = document.querySelectorAll<HTMLAnchorElement>(selector);
    for (const a of anchors) {
      let href = a.href;
      if (!href) continue;

      // /url?q=... 形式のリダイレクトを展開
      try {
        const u = new URL(href, location.href);
        if (u.pathname === '/url' && u.searchParams.get('q')) {
          href = u.searchParams.get('q')!;
        }
      } catch {
        continue;
      }

      // フィルタ: 内部リンク、google.com への遷移は除外
      if (!/^https?:\/\//.test(href)) continue;
      if (/^https?:\/\/(www\.)?google\.[^/]+\//.test(href)) continue;
      if (href.startsWith('#')) continue;

      // 同一ホストの重複は除去（先頭のみ採用）
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

// document_idle で実行されるが、結果が遅延描画される場合に備えて少し待つ
const tryExtract = (attempt = 0) => {
  const urls = extractTopUrls();
  if (urls.length > 0 || attempt >= 5) {
    send(urls);
    return;
  }
  setTimeout(() => tryExtract(attempt + 1), 500);
};

tryExtract();
```

**ハマりどころ**:
- Google のセレクタは時々変わる。複数のフォールバックを並べているのはそのため。動かなくなったら DevTools で実際の DOM 構造を確認して優先セレクタを差し替える。
- CAPTCHA が出るとそもそもセレクタにヒットしない。その場合は `urls=[]` で送信されエラー扱いになる（仕様通り）。

---

## ステップ 9: Popup（Vue アプリ）

### 9-1. `src/popup/index.html`

```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SiteLens</title>
  </head>
  <body class="m-0 p-0">
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

### 9-2. `src/popup/style.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #app {
  width: 360px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

### 9-3. `src/popup/main.ts`

```ts
import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

createApp(App).mount('#app');
```

### 9-4. `src/popup/App.vue`

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { getState, subscribe } from '@/lib/storage';
import type { StoredState } from '@/types/analyze';
import AnalyzeButton from './components/AnalyzeButton.vue';
import CompanyInfo from './components/CompanyInfo.vue';
import ResultUrlList from './components/ResultUrlList.vue';

const state = ref<StoredState>({ status: 'idle', updatedAt: Date.now() });
let unsubscribe: (() => void) | null = null;

onMounted(async () => {
  state.value = await getState();
  unsubscribe = subscribe((s) => {
    state.value = s;
  });
});

onUnmounted(() => {
  unsubscribe?.();
});

function onAnalyze() {
  chrome.runtime.sendMessage({ type: 'ANALYZE_START' });
}
</script>

<template>
  <div class="p-4 space-y-4">
    <header class="flex items-center justify-between">
      <h1 class="text-lg font-semibold text-gray-800">SiteLens</h1>
      <span class="text-xs text-gray-400">{{ state.status }}</span>
    </header>

    <AnalyzeButton
      :disabled="state.status === 'analyzing' || state.status === 'searching'"
      @click="onAnalyze"
    />

    <p v-if="state.status === 'analyzing'" class="text-sm text-gray-600">
      サイトを分析中...
    </p>
    <p v-else-if="state.status === 'searching'" class="text-sm text-gray-600">
      Google検索中...
    </p>

    <div v-if="state.status === 'error'" class="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
      {{ state.error }}
    </div>

    <CompanyInfo v-if="state.data" :data="state.data" />
    <ResultUrlList v-if="state.urls && state.urls.length" :urls="state.urls" />
  </div>
</template>
```

### 9-5. `src/popup/components/AnalyzeButton.vue`

```vue
<script setup lang="ts">
defineProps<{ disabled?: boolean }>();
defineEmits<{ click: [] }>();
</script>

<template>
  <button
    class="w-full rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
    :disabled="disabled"
    @click="$emit('click')"
  >
    Analyze this site
  </button>
</template>
```

### 9-6. `src/popup/components/CompanyInfo.vue`

```vue
<script setup lang="ts">
import type { AnalyzeResponse } from '@/types/analyze';
defineProps<{ data: AnalyzeResponse }>();
</script>

<template>
  <section class="space-y-1 text-sm">
    <h2 class="text-base font-semibold text-gray-800">{{ data.company_name }}</h2>
    <p class="text-gray-600"><span class="font-medium">設立:</span> {{ data.year_founded }}</p>
    <p class="text-gray-600"><span class="font-medium">本社:</span> {{ data.headquarters }}</p>
    <p class="text-gray-700">{{ data.description }}</p>
    <p class="text-gray-700"><span class="font-medium">事業:</span> {{ data.products_and_services }}</p>
  </section>
</template>
```

### 9-7. `src/popup/components/ResultUrlList.vue`

```vue
<script setup lang="ts">
defineProps<{ urls: string[] }>();
</script>

<template>
  <section>
    <h3 class="mb-2 text-sm font-semibold text-gray-800">関連検索結果</h3>
    <ol class="space-y-1 text-xs">
      <li v-for="(url, i) in urls" :key="i" class="truncate">
        <a
          :href="url"
          target="_blank"
          rel="noopener"
          class="text-blue-600 hover:underline"
        >
          {{ i + 1 }}. {{ url }}
        </a>
      </li>
    </ol>
  </section>
</template>
```

**チェックポイント**: `npx vue-tsc --noEmit` で型エラーが出ないことを確認。

---

## ステップ 10: ビルドと Chrome へのロード

### 10-1. ビルド

```bash
npm run build
```

`dist/` ディレクトリが生成され、その中に `manifest.json`、`service-worker.js`、popup の HTML/JS、content script などが含まれていることを確認します。

```bash
ls dist/
```

### 10-2. Chrome に拡張機能を読み込む

1. Chrome を開き、アドレスバーに `chrome://extensions` を入力
2. 右上の「**デベロッパーモード**」を ON
3. 「**パッケージ化されていない拡張機能を読み込む**」をクリック
4. `frontend/dist/` ディレクトリを選択
5. SiteLens のカードが表示され、エラーがないことを確認

**ハマりどころ**: `dist/manifest.json` のパスが間違っていると読み込みエラーになる。`vite build` 後に `manifest.json` が生成されているかを必ず確認。

---

## ステップ 11: 動作確認

### 11-1. バックエンド未実装時のモック

バックエンド API がまだ無い場合は、`src/lib/api.ts` を一時的に下記に差し替えます:

```ts
import type { AnalyzeResponse } from '@/types/analyze';

export async function fetchAnalyze(domain: string): Promise<AnalyzeResponse> {
  await new Promise((r) => setTimeout(r, 500));
  return {
    company_name: 'Apple Inc.',
    year_founded: 1976,
    headquarters: 'Cupertino, California, USA',
    description: 'Designs, manufactures, and markets consumer electronics.',
    products_and_services: 'iPhone, Mac, iPad, Services',
    search_query: `${new URL(domain).hostname} company news 2026`,
  };
}
```

差し替え後、再度 `npm run build` してから Chrome の拡張機能ページで「再読み込み」ボタンを押す。

### 11-2. 動作テスト

1. `https://www.apple.com/jp/iphone` などを開く
2. 拡張機能アイコンをクリックし、ポップアップを開く
3. 「Analyze this site」をクリック
4. ローディング表示の後、新しいタブで Google検索が開く
5. 検索結果ページの DOM 解析が完了したら、ポップアップを再オープン
6. 企業情報 + 上位10件の URL リストが表示されることを確認

### 11-3. エラーケース確認

| ケース | 期待される表示 |
|---|---|
| `chrome://newtab` の状態でクリック | 「このページは分析できません」 |
| バックエンドを停止して試行 | 「API request failed: ...」 |
| Google で CAPTCHA が出る環境 | 「検索結果からURLを取得できませんでした」 or タイムアウト |

### 11-4. 開発モード（HMR）

```bash
npm run dev
```

CRXJS の HMR が有効なため、popup の Vue ファイルを編集すると拡張機能が自動で再読み込みされます（service worker や content script の変更は手動でのリロードが必要な場合あり）。

---

## ステップ 12: バックエンド連携時の最終確認

バックエンド API が用意できたら以下を行います:

1. `src/lib/api.ts` を本来の実装に戻す（モックを削除）
2. `.env` の `VITE_API_BASE_URL` を本番（または開発）のエンドポイントに合わせる
3. `src/manifest.ts` の `host_permissions` に本番の API ホストを追加（CORS 回避のため）
   - 例: `'https://api.sitelens.example.com/*'`
4. `npm run build` → Chrome で「再読み込み」
5. 実 API でフローを通す

---

## トラブルシューティング Tips

| 症状 | 原因と対処 |
|---|---|
| 拡張機能読み込み時に「Service worker registration failed」 | `service-worker.ts` の import 文に拡張子付きの相対パスが必要な場合あり。Vite が解決するため通常は不要だが、エラーが出たら確認 |
| popup が真っ白 | `chrome://extensions` で SiteLens の「エラー」ボタンを開いてコンソール出力を確認。多くは Tailwind の CSS 読込ミス or ESM パスエラー |
| content script が動かない | `manifest.ts` の `matches` パターンを確認。`https://www.google.co.jp/search*` は別途追加が必要 |
| API リクエストが CORS で失敗 | `host_permissions` にバックエンドのオリジンを追加して再ビルド |
| `import.meta.env.VITE_API_BASE_URL` が undefined | `.env` ファイルをプロジェクトルート（`frontend/` 直下）に置いているか確認 |

---

## 完了基準

- [x] `npm run build` がエラーなく完了する
- [ ] `dist/` を Chrome に読み込めて、エラーが表示されない
- [ ] 任意の HTTPS サイトで「Analyze this site」が動作する
- [ ] バックエンドからの企業情報がポップアップに表示される
- [ ] Google検索タブが開き、上位10件の URL が抽出されてポップアップに表示される
- [ ] エラーケース（chrome://, API ダウン, タイムアウト）でユーザーフレンドリーなメッセージが出る
