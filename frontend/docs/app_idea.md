# SiteLens4 Frontend - アプリ仕様

## 目的（Context）

`/Users/takebumi/Documents/Python_Codes/SiteLens4/frontend` をルートとして、Chrome拡張機能のフロントエンドをゼロから構築する。

ユーザーが任意のWebサイトを開いた状態でブラウザ右上の拡張機能アイコンをクリックすると、ポップアップが表示される。ポップアップ内の「Analyze this site」ボタンを押すと、現在開いているタブのオリジン（例: `https://www.apple.com`）をバックエンドAPIに送信し、企業情報のJSONを受け取る。続けて、APIが返した `search_query` を使ってGoogle検索を新しいタブで実行し、その結果ページから上位10件のURLを抽出してポップアップに一覧表示する。

## 確定済み要件

| 項目 | 決定事項 |
|---|---|
| ドメイン送信形式 | **オリジン**（`new URL(tabUrl).origin` の結果。例: `https://www.apple.com`） |
| Google検索結果取得方法 | **新しいタブを開いてcontent scriptでDOM抽出**（最も成功率が高く、要件にも忠実） |
| バックエンドAPI | 仕様未定。`.env` の `VITE_API_BASE_URL` で切替できるプレースホルダー実装で進める |
| 取得した10件のURL | ポップアップに一覧表示するのみ（バックエンドへの再送信は不要） |
| Manifestバージョン | Manifest V3 |

## 技術スタック（最新安定版を使用）

| 用途 | ライブラリ |
|---|---|
| ビルドツール | Vite 5.x |
| フレームワーク | Vue 3.x（Composition API + `<script setup>`） |
| 言語 | TypeScript 5.x |
| Chrome拡張ビルド | `@crxjs/vite-plugin`（Vite用CRX拡張プラグイン） |
| Vue統合 | `@vitejs/plugin-vue` |
| CSS | Tailwind CSS 3.x + PostCSS + Autoprefixer |
| Chrome型定義 | `@types/chrome` |

## ディレクトリ構成

```
frontend/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.js
├── postcss.config.js
├── .env                          # VITE_API_BASE_URL のデフォルト
├── .env.example
├── .gitignore
├── src/
│   ├── manifest.ts               # MV3マニフェストをTSで定義（CRXJS方式）
│   ├── popup/
│   │   ├── index.html            # ポップアップエントリHTML
│   │   ├── main.ts               # Vueマウント
│   │   ├── App.vue               # ルートコンポーネント
│   │   ├── components/
│   │   │   ├── AnalyzeButton.vue
│   │   │   ├── CompanyInfo.vue   # company_name, year_founded等を表示
│   │   │   └── ResultUrlList.vue # 上位10件URLを表示
│   │   └── style.css             # @tailwind directives
│   ├── background/
│   │   └── service-worker.ts     # オーケストレーション（API呼出・タブ作成・状態保存）
│   ├── content/
│   │   └── google-scraper.ts     # google.com/search でDOMから上位10件URL抽出
│   ├── lib/
│   │   ├── api.ts                # fetchAnalyze(domain): バックエンドAPI呼出
│   │   ├── messages.ts           # chrome.runtime メッセージの型定義
│   │   └── storage.ts            # chrome.storage.local ラッパ（型付き）
│   └── types/
│       └── analyze.ts            # AnalyzeResponse型 (company_name等)
```

## アーキテクチャ・データフロー

ポップアップは新しいタブを開くと閉じてしまうため、**処理は service worker に委譲し、状態は `chrome.storage.local` に保存**して、ポップアップ再オープン時に復元する設計にする。

```
[User] click extension icon
   ↓
[Popup] mount → chrome.storage.localから前回状態を復元して表示
   ↓
[User] click "Analyze this site"
   ↓
[Popup] chrome.runtime.sendMessage({type: 'ANALYZE_START'})
   ↓
[Background SW]
   1. chrome.tabs.query({active:true, currentWindow:true}) で現在タブ取得
   2. const domain = new URL(tab.url).origin
   3. status='analyzing' を chrome.storage に保存（ポップアップへブロードキャスト）
   4. POST {VITE_API_BASE_URL}/api/analyze  body={domain}
   5. レスポンス(AnalyzeResponse)を受信
   6. status='searching' を保存
   7. chrome.tabs.create({url: `https://www.google.com/search?q=${encodeURIComponent(resp.search_query)}`})
   8. 作成タブIDを記憶し、その完了を待つ（chrome.tabs.onUpdated listener）
   ↓
[Google Tab] content script (google-scraper.ts) が DOMContentLoaded 後に実行
   - 複数セレクタフォールバックで上位10件のリンク要素を抽出
     - 第1候補: `div#search div.g a[href]:not([href^="/search"]):not([href^="#"])`
     - 第2候補: `a[jsname][href^="http"]`
     - 第3候補: `div[data-sokoban-container] a[href^="http"]`
   - リダイレクト形式 `/url?q=...` の場合はパラメータを展開
   - 重複を排除して最初の10件
   - chrome.runtime.sendMessage({type:'GOOGLE_RESULTS', urls})
   ↓
[Background SW]
   - urls を受信し、completeなAnalyzeResult({company info..., urls})を chrome.storage.local に保存
   - status='done' を保存
   - chrome.runtime.sendMessage で popup へ通知（開いていれば即座に更新）
   ↓
[Popup] (再オープン or 開いたまま) chrome.storage.local.onChanged で再描画
   - 企業情報セクション + 10件URLリストを表示
```

### エラー処理方針
- API失敗 / Googleページ読込タイムアウト(15s) / セレクタが何もマッチしない場合: `status='error'` + `errorMessage` を保存し、ポップアップに表示
- 既存タブが `chrome://` や `file://` の場合は「このページは分析できません」と表示

## 主要ファイルの設計

### `src/types/analyze.ts`
```ts
export interface AnalyzeResponse {
  company_name: string;
  year_founded: string | number;
  headquarters: string;
  description: string;
  products_and_services: string;
  search_query: string;
  [key: string]: unknown; // 将来追加される他キーを許容
}

export type AnalysisStatus = 'idle' | 'analyzing' | 'searching' | 'done' | 'error';

export interface StoredState {
  status: AnalysisStatus;
  domain?: string;
  data?: AnalyzeResponse;
  urls?: string[];
  error?: string;
  updatedAt: number;
}
```

### `src/lib/api.ts`
```ts
export async function fetchAnalyze(domain: string): Promise<AnalyzeResponse> {
  const base = import.meta.env.VITE_API_BASE_URL;
  const res = await fetch(`${base}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}
```

### `src/manifest.ts`（CRXJS形式）
```ts
import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'SiteLens',
  version: '0.1.0',
  action: { default_popup: 'src/popup/index.html' },
  background: { service_worker: 'src/background/service-worker.ts', type: 'module' },
  permissions: ['tabs', 'storage', 'activeTab', 'scripting'],
  host_permissions: [
    'https://www.google.com/*',
    'http://localhost/*',
  ],
  content_scripts: [{
    matches: ['https://www.google.com/search*'],
    js: ['src/content/google-scraper.ts'],
    run_at: 'document_idle',
  }],
});
```

### `vite.config.ts`
```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest';

export default defineConfig({
  plugins: [vue(), crx({ manifest })],
});
```

### `.env.example`
```
VITE_API_BASE_URL=http://localhost:8000
```

## 検証シナリオ

1. `npm run build` でビルドし、`dist/` が生成されることを確認
2. Chrome の `chrome://extensions` で「デベロッパーモード」を有効化 → `dist/` を「パッケージ化されていない拡張機能を読み込む」
3. 任意のサイト（例: `https://www.apple.com/jp/iphone`）を開き、拡張機能アイコンをクリック
4. ポップアップに「Analyze this site」が表示されることを確認
5. バックエンド未実装段階では、`api.ts` を一時的にモックレスポンスを返すように差し替えて動作確認
6. ボタンクリック後の挙動:
   - 新しいGoogleタブが開き、`search_query` で検索される
   - content scriptが動作し、上位10件のURLが popup（再オープン時）に表示される
7. エラーケース確認:
   - `chrome://newtab` の状態でクリック → 「このページは分析できません」が表示
   - APIをわざと落とす → エラーメッセージが表示
8. `npm run dev` でHMRが効くこと（CRXJSはHMR対応）
