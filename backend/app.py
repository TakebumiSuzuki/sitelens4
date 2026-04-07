import json
import os
from typing import Optional
from urllib.parse import urlparse

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel, ValidationError

load_dotenv()

app = Flask(__name__)
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])


class CompanyAnalysis(BaseModel):
    company_name: str
    year_founded: Optional[int] = None
    headquarters: str
    description: str
    products_and_services: str
    search_query: str


@app.route("/api/analyze", methods=["POST"])
def analyze():
    body = request.get_json(silent=True)
    if not body or "domain" not in body:
        return jsonify({"error": "domain field is required"}), 400

    domain = body["domain"]
    hostname = urlparse(domain).hostname or domain

    prompt = f"""以下のURLのウェブサイトについて、Google検索を使って調査し、
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
- Googleサイト内検索で製品・サービスページが見つかる最適なクエリにする"""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())]
            ),
        )
    except genai_errors.ClientError as e:
        return jsonify({"error": f"Gemini API error: {e}"}), 502

    try:
        text = response.text.strip()
        # Gemini がマークダウンのコードブロックで返した場合に対応
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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
