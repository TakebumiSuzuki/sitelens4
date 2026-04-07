# SiteLens4 Backend 使用マニュアル

## 前提条件

- Python 3.11 以上
- `uv` インストール済み
- Google AI Studio で取得した Gemini API キー

---

## 初回セットアップ（共通）

```bash
cd backend

# 依存パッケージのインストール
uv sync

# 環境変数ファイルを作成
cp .env.example .env
```

`.env` を開き、APIキーを設定する:

```
GEMINI_API_KEY=AIzaSy...（実際のキーに置き換え）
```

---

## 開発環境

### サーバー起動

```bash
uv run python app.py
```

Flask の開発サーバーが起動する（デバッグモード有効）:

```
 * Running on http://127.0.0.1:8000
 * Debug mode: on
```

### 動作確認

```bash
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"domain": "https://apple.com"}'
```

期待するレスポンス:

```json
{
  "company_name": "Apple Inc.",
  "year_founded": 1976,
  "headquarters": "Cupertino, California, USA",
  "description": "Designs, manufactures, and markets consumer electronics and software.",
  "products_and_services": "iPhone, Mac, iPad, Apple Watch, Services",
  "search_query": "site:apple.com (iPhone OR Mac OR iPad OR \"Apple Watch\") -blog"
}
```

### 注意事項

- コードを変更すると Flask が自動でリロードする（デバッグモードのため）
- ターミナルで `Ctrl+C` を押すと停止

---

## 本番環境

Flask の開発サーバーは本番用途に適さない。`gunicorn` を WSGI サーバーとして使用する。

### gunicorn のインストール

```bash
uv add gunicorn
```

### サーバー起動

```bash
uv run gunicorn app:app --bind 0.0.0.0:8000 --workers 2
```

| オプション | 説明 |
|---|---|
| `app:app` | `app.py` の Flask インスタンス `app` を指定 |
| `--bind 0.0.0.0:8000` | 全インターフェースの 8000 番ポートで待ち受け |
| `--workers 2` | ワーカープロセス数（CPUコア数 × 2 + 1 が目安） |

### バックグラウンドで起動する場合

```bash
uv run gunicorn app:app --bind 0.0.0.0:8000 --workers 2 \
  --daemon --pid /tmp/sitelens.pid --log-file /tmp/sitelens.log
```

停止:

```bash
kill $(cat /tmp/sitelens.pid)
```

### 本番環境の注意事項

- `.env` ファイルではなく、OS の環境変数や秘密管理サービスで `GEMINI_API_KEY` を管理することを推奨
- `app.py` 内の `debug=True` は開発サーバー経由でのみ有効。gunicorn 経由では無効になるため変更不要
- HTTPS 終端は nginx などのリバースプロキシに任せる

---

## エラーレスポンス一覧

| HTTPステータス | 原因 | レスポンス例 |
|---|---|---|
| 400 | `domain` フィールドがない | `{"error": "domain field is required"}` |
| 502 | Gemini API エラー（無効なキーなど） | `{"error": "Gemini API error: ..."}` |
| 500 | Gemini のレスポンスを JSON としてパースできなかった | `{"error": "Failed to parse Gemini response: ..."}` |
