from pdfminer.high_level import extract_text
from typing import Optional


def extract_text_from_pdf(path: str) -> str:
    text = extract_text(path)
    return text or ""
