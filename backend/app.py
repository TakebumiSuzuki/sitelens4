import json
import os
from urllib.parse import urlparse

from dotenv import load_dotenv
from flask import Flask, request
from google import genai
from google.genai import errors as genai_errors
from pydantic import BaseModel, ValidationError

load_dotenv()

app = Flask(__name__)
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])


class CompanyAnalysis(BaseModel):
    company_name: str
    year_founded: int | None = None
    headquarters: str
    description: str
    products_and_services: str
    search_query: str


@app.post("/api/analyze")
def analyze():
    body = request.get_json(silent=True)
    if not body or "domain" not in body:
        return {"error": "domain field is required"}, 400

    domain = body["domain"]
    hostname = urlparse(domain).hostname or domain

    prompt = f"""以下のURLのウェブサイトについて、Google検索を使って調査し、
指定のJSONスキーマで回答してください。

URL: {domain}

search_queryのルール:
- site:{hostname} で始める
- 会社の主要な製品・サービス名をOR演算子でつなぐ
- 末尾に必ず -blog をつける
- Googleサイト内検索で製品・サービスページが見つかる最適なクエリにする"""

    try:
        response = client.models.generate_content(
            model="gemini-3.1-pro-preview",
            contents=prompt,
            config={
                "tools": [{"google_search": {}}],
                "response_mime_type": "application/json",
                "response_json_schema": CompanyAnalysis.model_json_schema(),
            },
        )
    except genai_errors.ClientError as e:
        return {"error": f"Gemini API error: {e}"}, 502

    try:
        return CompanyAnalysis.model_validate_json(response.text).model_dump()

    except (json.JSONDecodeError, ValidationError) as e:
        return {"error": f"Failed to parse Gemini response: {e}"}, 500
