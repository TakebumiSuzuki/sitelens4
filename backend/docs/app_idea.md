# SiteLens4 Backend API 仕様書

## 概要

Chrome拡張（フロントエンド）からドメインURLを受け取り、Gemini API の Google Search Grounding を使ってそのサイトの会社情報を分析し、JSON形式で返すFlask APIサーバー。

---

## エンドポイント

### `POST /api/analyze`

#### リクエスト

```
Content-Type: application/json
```

```json
{
  "domain": "https://apple.com"
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| `domain` | string | 分析対象のサイトURL（オリジン形式） |

#### レスポンス（成功時 200）

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

| フィールド | 型 | 説明 |
|---|---|---|
| `company_name` | string | 会社の正式名称 |
| `year_founded` | integer \| null | 創業年（不明な場合は null） |
| `headquarters` | string | 本社所在地（"City, Country" 形式） |
| `description` | string | 会社概要（英語） |
| `products_and_services` | string | 主な製品・サービス（カンマ区切り） |
| `search_query` | string | Google サイト内検索クエリ（後述） |

#### レスポンス（エラー時）

```json
{ "error": "エラーメッセージ" }
```

---

## `search_query` の仕様

この会社が提供する製品・サービスのページを Google のサイト内検索で取得するための最適なクエリ文字列。

**ルール:**
- `site:{hostname}` で始める
- 主要な製品・サービス名を `OR` 演算子でつなぐ
- 末尾に必ず `-blog` をつける

**例:**
```
site:apple.com (iPhone OR Mac OR iPad OR "Apple Watch") -blog
```

---

## 技術スタック

| 項目 | 選択 | 理由 |
|---|---|---|
| Webフレームワーク | Flask | 軽量・シンプル |
| パッケージ管理 | uv | 高速・モダン（pip不使用） |
| AI API | Google Gemini (`google-genai`) | 最新SDK、Google Search Grounding対応 |
| スキーマ定義 | Pydantic | レスポンスバリデーション |
| 環境変数 | python-dotenv | `.env`ファイルからAPIキー読み込み |
| CORS | 不要 | アクセス元はChrome拡張のみ（CORSポリシー非適用） |

---

## Gemini 呼び出し設計

### Google Search Grounding

Gemini の `google_search` ツールを有効化し、渡されたドメインURLについてウェブ検索させる。これにより最新情報を取得できる。

```python
config = types.GenerateContentConfig(
    tools=[types.Tool(google_search=types.GoogleSearch())]
)
```

### 制約: Grounding と構造化出力の併用不可

Gemini API の仕様上、`google_search` grounding と `response_json_schema`（構造化出力）は**同時使用できない**。

対応策:
- `response_json_schema` は使わない
- プロンプトで「純粋なJSONのみを返せ」と明示的に指示
- `response.text` を `json.loads()` でパース

### プロンプト設計

```
以下のURLのウェブサイトについて、Google検索を使って調査し、
下記のJSONフォーマットのみで回答してください。JSONの前後に他のテキストは一切含めないこと。

URL: {domain}

{
  "company_name": "会社の正式名称",
  "year_founded": 創業年（整数、不明な場合は null）,
  "headquarters": "本社所在地（City, Country形式）",
  "description": "会社概要（英語で簡潔に）",
  "products_and_services": "提供する主な製品・サービス（カンマ区切り）",
  "search_query": "site:{hostname} (製品A OR 製品B OR サービスC) -blog"
}

search_queryのルール:
- site:{hostname} で始める
- 会社の主要な製品・サービス名をOR演算子でつなぐ
- 末尾に必ず -blog をつける
- Googleサイト内検索で製品・サービスページが見つかる最適なクエリにする
```

---

## ファイル構成

```
backend/
├── app.py           # Flask app + /api/analyze エンドポイント（全ロジック）
├── pyproject.toml   # uv 管理のプロジェクト設定・依存パッケージ定義
├── .env             # APIキー（gitignore対象）
├── .env.example     # 環境変数テンプレート
├── .gitignore
└── docs/
    ├── app_idea.md     # 本ファイル（仕様書）
    └── dev_process.md  # 開発手順
```

---

## 環境変数

| 変数名 | 説明 |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio で発行した Gemini API キー |
