"""Helper CLI to call the Node.js NEET OMR evaluation endpoint.

Usage example (after generating JSON with `omr_pipeline.py`):

    python omr_pipeline.py --mode answer_key --image ans_key.jpg > answer_key.json
    python omr_pipeline.py --mode student --image student_omr.jpg > student_answers.json

    python omr_call_backend.py \
        --submission-id 6655... \
        --answer-key-json answer_key.json \
        --student-json student_answers.json \
        --api-base http://localhost:8080/api/v1/examiner

This will call:
    POST {api-base}/exam/evaluate/{submissionId}
with body:
    {"answerKey": [...], "studentAnswers": [...]}.
"""

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List

import requests


def load_json(path: str | Path) -> Any:
    p = Path(path)
    with p.open("r", encoding="utf-8") as f:
        return json.load(f)


def call_backend_evaluate(
    submission_id: str,
    answer_key: List[Dict],
    student_answers: List[Dict],
    api_base: str,
    token: str | None = None,
) -> Dict:
    url = f"{api_base}/exam/evaluate/{submission_id}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    payload = {"answerKey": answer_key, "studentAnswers": student_answers}
    resp = requests.post(url, headers=headers, data=json.dumps(payload))
    resp.raise_for_status()
    return resp.json()


def main() -> None:
    parser = argparse.ArgumentParser(description="Call NEET OMR backend evaluation API")
    parser.add_argument("--submission-id", required=True, help="ExamSubmission _id")
    parser.add_argument("--answer-key-json", required=True, help="Path to answerKey JSON file")
    parser.add_argument("--student-json", required=True, help="Path to studentAnswers JSON file")
    parser.add_argument(
        "--api-base",
        default="http://localhost:8080/api/v1/examiner",
        help="Base URL for backend examiner API",
    )
    parser.add_argument("--token", help="Optional bearer token for Authorization header")

    args = parser.parse_args()

    answer_key = load_json(args.answer_key_json)
    student_answers = load_json(args.student_json)

    result = call_backend_evaluate(
        submission_id=args.submission_id,
        answer_key=answer_key,
        student_answers=student_answers,
        api_base=args.api_base,
        token=args.token,
    )

    print(json.dumps(result, indent=2))


if __name__ == "__main__":  # pragma: no cover
    main()
