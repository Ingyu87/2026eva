"""
교육청 평가문항 예시 자료 PDF에서 표를 뽑아 원본 JSON으로 저장합니다.

    python scripts/extract_question_bank.py "1_(초)2026 학교평가 평가문항 예시 자료.pdf" \
        --level elementary --out .parsed/question-bank-2026-raw.json

여기서는 표를 "있는 그대로" 뽑기만 합니다. 정리·검증은 build-question-bank.mjs가 맡습니다.
둘을 나눠 두면 추출 방법이 바뀌어도(로컬 파싱 → Upstage) 뒤쪽을 고치지 않아도 됩니다.

필요 패키지: pymupdf
"""

import argparse
import json
import os
import sys

try:
    import fitz  # pymupdf
except ImportError:  # pragma: no cover
    sys.exit("pymupdf가 필요합니다:  pip install pymupdf")

HEADER_FIRST_CELL = "영역"


def extract(path: str) -> list[dict]:
    doc = fitz.open(path)
    rows: list[dict] = []

    for page_no, page in enumerate(doc, start=1):
        for table in page.find_tables().tables:
            for cells in table.extract():
                if len(cells) < 4:
                    continue
                cells = [(c or "").strip() for c in cells[:4]]
                # 표 머리글은 페이지마다 반복되므로 건너뜁니다.
                if cells[0] == HEADER_FIRST_CELL:
                    continue
                if not any(cells):
                    continue
                rows.append(
                    {
                        "page": page_no,
                        "area": cells[0],
                        "subarea": cells[1],
                        "indicator": cells[2],
                        "question": cells[3],
                    }
                )

    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf")
    parser.add_argument("--level", default="elementary")
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument("--out", default=".parsed/question-bank-2026-raw.json")
    args = parser.parse_args()

    rows = extract(args.pdf)

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fp:
        json.dump(
            {
                "source": os.path.basename(args.pdf),
                "year": args.year,
                "schoolLevel": args.level,
                "rows": rows,
            },
            fp,
            ensure_ascii=False,
            indent=2,
        )

    print(f"{len(rows)}행 추출 -> {args.out}")


if __name__ == "__main__":
    main()
