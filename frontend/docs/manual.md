# SiteLens - 使い方マニュアル

---

## 開発環境での使い方

### 前提条件

- Node.js v18 以上
- Google Chrome

### セットアップ（初回のみ）

```bash
cd frontend
npm install
cp .env.example .env
```

### モードの切り替え（`.env`）

```
VITE_API_BASE_URL=http://localhost:8000
VITE_USE_MOCK=true    # バックエンドなしで動作確認する場合
# VITE_USE_MOCK=false # バックエンドに繋ぐ場合
```

### ビルドして Chrome に読み込む

```bash
npm run build
```

1. Chrome で `chrome://extensions` を開く
2. 右上の「**デベロッパーモード**」を ON にする
3. 「**パッケージ化されていない拡張機能を読み込む**」をクリック
4. `frontend/dist/` フォルダを選択する

> コードを変更するたびに `npm run build` を再実行し、`chrome://extensions` の SiteLens カードにある「**再読み込み**（↺）**」ボタンを押してください。

### 開発サーバー（HMR）

Popup の Vue ファイルはホットリロードに対応しています。

```bash
npm run dev
```

拡張機能を読み込む際は `dist/` の代わりに Vite が自動生成するディレクトリを使います（CRXJSが管理）。Service worker や content script を変更した場合は手動で「再読み込み」が必要です。

### モックモードでの動作確認

`.env` の `VITE_USE_MOCK=true` の状態でビルドすると、バックエンドなしで以下のダミーデータが返ります：

| フィールド | 値 |
|---|---|
| company_name | Apple Inc. |
| year_founded | 1976 |
| headquarters | Cupertino, California, USA |
| search_query | `{hostname} company news 2026` |

動作フロー（モック時）：
1. 任意の HTTPS サイト（例: `https://www.apple.com`）を開く
2. 拡張機能アイコン（パズルピース）→ SiteLens をクリック
3. 「**Analyze this site**」ボタンをクリック
4. 0.5秒後、Google検索タブが自動で開く
5. 検索完了後、ポップアップを再度開くと企業情報と上位10件の URL が表示される

### よくあるエラーと対処

| 症状 | 原因 | 対処 |
|---|---|---|
| ポップアップが真っ白 | ビルドエラー or CSS 読込ミス | `chrome://extensions` の「エラー」ボタンでログ確認 |
| 「このページは分析できません」 | `chrome://` や `file://` のページで実行した | HTTPS サイトで試す |
| 検索結果が取得できない | Google の DOM 構造変更 or CAPTCHA | DevTools で `div#search div.g a` を確認して `google-scraper.ts` のセレクタを修正 |
| `VITE_API_BASE_URL is not set` | `.env` ファイルが存在しない | `cp .env.example .env` を実行 |
| Service worker が登録されない | ビルド後に再読み込みしていない | `chrome://extensions` で「再読み込み」ボタンを押す |

---

## 本番環境での使い方

### バックエンド接続の設定

`.env` を以下のように編集します：

```
VITE_API_BASE_URL=https://your-backend.example.com
VITE_USE_MOCK=false
```

### `src/manifest.ts` に本番 API ホストを追加

Chrome 拡張機能は `host_permissions` に登録されていないホストへのリクエストが CORS でブロックされます。

```ts
host_permissions: [
  'https://www.google.com/*',
  'https://your-backend.example.com/*',  // ← 追加
],
```

### ビルドと Chrome への配布

```bash
npm run build
```

生成された `dist/` フォルダが配布物です。

**個人・チーム内で使う場合（デベロッパーモード）:**
- 上記「開発環境」と同じ手順で `dist/` を読み込む

**Chrome Web Store に公開する場合:**
1. `dist/` フォルダを ZIP に圧縮する
   ```bash
   cd dist && zip -r ../sitelens.zip . && cd ..
   ```
2. [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole) にアップロード

### バックエンド API の仕様

拡張機能は以下のリクエストを送信します：

```
POST {VITE_API_BASE_URL}/api/analyze
Content-Type: application/json

{ "domain": "https://www.example.com" }
```

期待するレスポンス（JSON）：

```json
{
  "company_name": "Example Corp",
  "year_founded": "2000",
  "headquarters": "Tokyo, Japan",
  "description": "...",
  "products_and_services": "...",
  "search_query": "Example Corp company news"
}
```

### バージョンアップ時の手順

1. `src/manifest.ts` の `version` を更新（例: `"0.1.0"` → `"0.2.0"`）
2. `.env` の設定を確認
3. `npm run build`
4. Chrome で「再読み込み」または Web Store へ再アップロード
