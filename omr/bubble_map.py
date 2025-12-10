"""Bubble center coordinates for the aligned OMR sheet.

These coordinates are defined on the warped / aligned OMR image used by
`omr_pipeline.py`. You must update them to match your actual OMR
layout (positions of bubbles for each question and option).

The example values below are purely illustrative and cover only a
few questions so the script can run end‑to‑end even without a
real OMR template.
"""

# Example map: questionNumber -> { option -> (x, y) }
BUBBLE_CENTERS = {
    1: {"A": (200, 400), "B": (260, 400), "C": (320, 400), "D": (380, 400)},
    2: {"A": (200, 450), "B": (260, 450), "C": (320, 450), "D": (380, 450)},
    3: {"A": (200, 500), "B": (260, 500), "C": (320, 500), "D": (380, 500)},
}
