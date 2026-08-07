"""Buat ringkasan padat per lesson dari teks materi untuk dasar penulisan soal."""
import json
import os
import re

IN = r"C:/Users/erlan/Documents/ops-edu-quiz/data/material-texts"
OUT = r"C:/Users/erlan/Documents/ops-edu-quiz/data/material-digest"
os.makedirs(OUT, exist_ok=True)

courses = [
    "python-start-1st-year",
    "python-start-2nd-year",
    "python-pro-2nd-year",
    "visual-programming",
]

for course in courses:
    with open(os.path.join(IN, course + ".json"), encoding="utf-8") as f:
        docs = json.load(f)
    digest = []
    for doc in docs:
        text = doc.get("text", "")
        # buang watermark/noise umum slide
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        # ambil sampai 40 baris pertama yang bermakna
        picked = []
        for line in lines:
            if len(line) < 3:
                continue
            picked.append(line)
            if len(picked) >= 40:
                break
        digest.append({"file": doc["file"], "excerpt": " | ".join(picked)[:900]})
    with open(os.path.join(OUT, course + ".json"), "w", encoding="utf-8") as f:
        json.dump(digest, f, ensure_ascii=False, indent=1)
    print(course, "->", len(digest), "lessons digested")
