# SiteLens4 Backend 開発手順

## 前提条件

- Python 3.11 以上
- `uv` インストール済み（`curl -LsSf https://astral.sh/uv/install.sh | sh`）
- Google AI Studio で Gemini API キーを取得済み

---

## Step 1: プロジェクト初期化

```bash
cd backend
uv init
```

`pyproject.toml` と `.python-version` が生成される。

---

## Step 2: 依存パッケージの追加

```bash
uv add flask pydantic google-genai python-dotenv
```

`pyproject.toml` の `[project.dependencies]` に自動追記される。

---

## Step 3: 環境変数の設定

```bash
cp .env.example .env
```

`.env` を開き、`GEMINI_API_KEY` に Google AI Studio で取得したキーを設定する。

```
GEMINI_API_KEY=AIzaSy...
```

---

## Step 4: `app.py` の実装

以下の順序でコードを書く。

### 4-1. インポートと初期設定

```python
import json
import os
from urllib.parse import urlparse

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError
from typing import Optional

load_dotenv()

app = Flask(__name__)
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
```

### 4-2. Pydantic スキーマ定義（レスポンスバリデーション用）

```python
class CompanyAnalysis(BaseModel):
    company_name: str
    year_founded: Optional[int] = None
    headquarters: str
    description: str
    products_and_services: str
    search_query: str
```

### 4-3. `/api/analyze` エンドポイント

```python
@app.route("/api/analyze", methods=["POST"])
def analyze():
    body = request.get_json(silent=True)
    if not body or "domain" not in body:
        return jsonify({"error": "domain field is required"}), 400

    domain = body["domain"]
    hostname = urlparse(domain).hostname or domain

    prompt = f"""
以下のURLのウェブサイトについて、Google検索を使って調査し、
下記のJSONフォーマットのみで回答してください。JSONの前後に他のテキストは一切含めないこと。

URL: {domain}

{{
  "company_name": "会社の正式名称",
  "year_founded": 創業年（整数、不明な場合は null）,
  "headquarters": "本社所在地（City, Country形式）",
  "description": "会社概要（英語で簡潔に）",
  "products_and_services": "提供する主な製品・サービス（カンマ区切り）",
  "search_query": "site:{hostname} (製品A OR 製品B OR サービスC) -blog"
}}

search_queryのルール:
- site:{hostname} で始める
- 会社の主要な製品・サービス名をOR演算子でつなぐ
- 末尾に必ず -blog をつける
- Googleサイト内検索で製品・サービスページが見つかる最適なクエリにする
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())]
        ),
    )

    try:
        # マークダウンのコードブロックが混入する場合に備えてクリーニング
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
        data = json.loads(text)
        result = CompanyAnalysis(**data)
        return jsonify(result.model_dump())
    except (json.JSONDecodeError, ValidationError) as e:
        return jsonify({"error": f"Failed to parse Gemini response: {e}"}), 500
```

### 4-4. エントリーポイント

```python
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
```

---

## Step 5: サーバー起動

```bash
uv run python app.py
```

出力例:
```
 * Running on http://0.0.0.0:8000
 * Debug mode: on
```

---

## Step 6: 動作確認

### curl でテスト

```bash
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"domain": "https://apple.com"}'
```

### 期待するレスポンス

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

### チェックポイント

- [ ] 全6フィールドが返ってくる
- [ ] `search_query` が `site:` で始まる
- [ ] `search_query` に `OR` が含まれる
- [ ] `search_query` が `-blog` で終わる

---

## Step 7: `.gitignore` の設定

```
.env
.venv/
__pycache__/
*.pyc
```

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| `GEMINI_API_KEY` エラー | `.env` 未設定 | `.env` にキーを設定 |
| JSONパースエラー | Gemini がマークダウンで返した | Step 4-3 のクリーニング処理が対応済み |
| `google_search` が使えない | 無料枠の制限 | Google AI Studio でグラウンディングが有効か確認 |
| 500エラー | Pydantic バリデーション失敗 | レスポンスの生テキストをログで確認 |
