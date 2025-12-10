"""OMR processing pipeline for NEET‑style sheets.

Responsibilities:
- Load a scanned OMR image (answer key or student sheet).
- Preprocess and roughly align it to a fixed template size.
- For each bubble position defined in `bubble_map.BUBBLE_CENTERS`, crop a
  small patch and classify it as filled/empty.
- Build `answerKey` / `studentAnswers` JSON compatible with the
  Node.js backend `/exam/evaluate/:submissionId` endpoint.

The classifier supports two modes:
- Simple intensity heuristic (no ML dependencies, default).
- Optional CNN mode if a TensorFlow/Keras model file is provided and
  `tensorflow` is installed.
"""

import argparse
import json
import os
from typing import Dict, List, Tuple

import cv2
import numpy as np
import requests

try:
    # Optional dependency – only used if a model path is provided
    from tensorflow.keras.models import load_model  # type: ignore
except Exception:  # tensorflow not installed
    load_model = None  # type: ignore

from bubble_map import BUBBLE_CENTERS

TEMPLATE_WIDTH = 2480   # example A4 @ 300dpi
TEMPLATE_HEIGHT = 3508


class BubbleClassifier:
    """Classifies bubble patches as filled or empty.

    If a Keras model path is provided and can be loaded, uses that CNN.
    Otherwise falls back to a simple intensity‑based heuristic.
    """

    def __init__(self, model_path: str | None = None, threshold: float = 0.5) -> None:
        self.threshold = threshold
        self.model = None
        self.use_cnn = False

        if model_path and load_model is not None and os.path.exists(model_path):
            try:
                self.model = load_model(model_path)
                self.use_cnn = True
            except Exception:
                # Fall back to heuristic if model cannot be loaded
                self.model = None
                self.use_cnn = False

    def predict_probs(self, patches: np.ndarray) -> np.ndarray:
        """Return probability of being filled for each patch.

        patches: (N, H, W, 1) float32 in [0, 1]
        """

        if self.use_cnn and self.model is not None:
            preds = self.model.predict(patches, verbose=0)
            preds = np.array(preds).reshape(-1)
            return preds

        # Heuristic mode: darker patches -> higher probability of being filled
        # Compute mean intensity per patch and invert.
        means = patches.mean(axis=(1, 2, 3))  # (N,)
        probs = 1.0 - means  # darker -> closer to 1
        return probs


def load_and_align(path: str) -> np.ndarray:
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"Cannot read image: {path}")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # For now we simply resize to the template; for production you
    # should detect corner markers and apply a perspective transform.
    aligned = cv2.resize(thresh, (TEMPLATE_WIDTH, TEMPLATE_HEIGHT))
    return aligned


def crop_patch(img: np.ndarray, center: Tuple[int, int], size: int = 28) -> np.ndarray:
    cx, cy = center
    half = size // 2
    x1 = int(cx - half)
    y1 = int(cy - half)
    x2 = int(cx + half)
    y2 = int(cy + half)
    patch = img[y1:y2, x1:x2]
    if patch.shape != (size, size):
        patch = cv2.resize(patch, (size, size))
    patch = patch.astype("float32") / 255.0
    patch = np.expand_dims(patch, axis=-1)  # (H, W, 1)
    return patch


def infer_bubbles(
    classifier: BubbleClassifier,
    aligned_img: np.ndarray,
    prob_threshold: float = 0.7,
) -> List[Dict]:
    """Infer which bubbles are filled.

    Returns a list of dicts with
    {questionNumber, option, centerX, centerY, confidence}.
    """

    patches: List[np.ndarray] = []
    meta: List[Tuple[int, str, int, int]] = []

    for q_num, options in BUBBLE_CENTERS.items():
        for opt, (x, y) in options.items():
            patch = crop_patch(aligned_img, (x, y))
            patches.append(patch)
            meta.append((int(q_num), str(opt), int(x), int(y)))

    if not patches:
        return []

    batch = np.stack(patches, axis=0)  # (N, H, W, 1)
    probs = classifier.predict_probs(batch)

    results: List[Dict] = []
    for (q_num, opt, x, y), p in zip(meta, probs):
        if float(p) >= prob_threshold:
            results.append(
                {
                    "questionNumber": q_num,
                    "option": opt,
                    "centerX": float(x),
                    "centerY": float(y),
                    "confidence": float(p),
                }
            )

    return results


def build_answer_key_json(bubble_results: List[Dict]) -> List[Dict]:
    by_q: Dict[int, List[Dict]] = {}
    for r in bubble_results:
        q = int(r["questionNumber"])
        by_q.setdefault(q, []).append(r)

    answer_key: List[Dict] = []
    for q, arr in by_q.items():
        best = max(arr, key=lambda x: x.get("confidence", 0.0))
        answer_key.append(
            {
                "questionNumber": q,
                "correctOption": str(best["option"]).upper(),
            }
        )
    return answer_key


def build_student_answers_json(bubble_results: List[Dict]) -> List[Dict]:
    by_q: Dict[int, List[Dict]] = {}
    for r in bubble_results:
        q = int(r["questionNumber"])
        by_q.setdefault(q, []).append(r)

    student_answers: List[Dict] = []
    for q, arr in by_q.items():
        best = max(arr, key=lambda x: x.get("confidence", 0.0))
        student_answers.append(
            {
                "questionNumber": q,
                "selectedOption": str(best["option"]).upper(),
                "centerX": float(best["centerX"]),
                "centerY": float(best["centerY"]),
                "confidence": float(best["confidence"]),
            }
        )
    return student_answers


def process_answer_key(image_path: str, model_path: str | None = None) -> List[Dict]:
    aligned = load_and_align(image_path)
    classifier = BubbleClassifier(model_path=model_path)
    bubbles = infer_bubbles(classifier, aligned)
    return build_answer_key_json(bubbles)


def process_student_omr(image_path: str, model_path: str | None = None) -> List[Dict]:
    aligned = load_and_align(image_path)
    classifier = BubbleClassifier(model_path=model_path)
    bubbles = infer_bubbles(classifier, aligned)
    return build_student_answers_json(bubbles)


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
    parser = argparse.ArgumentParser(description="NEET OMR processing pipeline")
    parser.add_argument("--mode", choices=["answer_key", "student"], required=True)
    parser.add_argument("--image", required=True, help="Path to scanned OMR image")
    parser.add_argument("--model", help="Optional Keras model .h5 path", default=None)
    parser.add_argument("--submission-id", help="If provided, call backend evaluate")
    parser.add_argument(
        "--api-base",
        default="http://localhost:8080/api/v1/examiner",
        help="Base URL for backend examiner API",
    )
    parser.add_argument(
        "--token",
        help="Optional bearer token if backend requires Authorization header",
    )

    args = parser.parse_args()

    if args.mode == "answer_key":
        answer_key = process_answer_key(args.image, model_path=args.model)
        print(json.dumps(answer_key, indent=2))
    else:
        student_answers = process_student_omr(args.image, model_path=args.model)
        print(json.dumps(student_answers, indent=2))

        if args.submission_id:
            # Note: in a real setup you would load the answer key JSON
            # from storage or recompute it from the instructor sheet.
            raise SystemExit(
                "submission-id provided but answerKey loading is not implemented in this CLI."
            )


if __name__ == "__main__":  # pragma: no cover
    main()
