import fitz
import json
import os
import re
import glob

SRC = r"C:/Users/erlan/Documents/SaaS/materials"
OUT = r"C:/Users/erlan/Documents/ops-edu-quiz/data/material-texts"
os.makedirs(OUT, exist_ok=True)

courses = [
    "python-start-1st-year",
    "python-start-2nd-year",
    "python-pro-2nd-year",
    "visual-programming",
]

summary = {}
for course in courses:
    cdir = os.path.join(SRC, course)
    pdfs = sorted(glob.glob(os.path.join(cdir, "modul-*", "*.pdf")))
    texts = []
    for pdf_path in pdfs:
        rel = os.path.relpath(pdf_path, cdir).replace("\\", "/")
        try:
            doc = fitz.open(pdf_path)
            text_parts = []
            for i, page in enumerate(doc):
                if i >= 20:
                    break
                text_parts.append(page.get_text())
            doc.close()
            text = "\n".join(text_parts)
            text = re.sub(r"\n{3,}", "\n\n", text).strip()
            texts.append({"file": rel, "chars": len(text), "text": text})
        except Exception as e:
            texts.append({"file": rel, "error": str(e), "text": ""})
    outpath = os.path.join(OUT, course + ".json")
    with open(outpath, "w", encoding="utf-8") as f:
        json.dump(texts, f, ensure_ascii=False, indent=1)
    ok = sum(1 for t in texts if t.get("text"))
    total_chars = sum(t.get("chars", 0) for t in texts)
    summary[course] = {
        "pdfs": len(pdfs),
        "ok": ok,
        "total_chars": total_chars,
    }

print(json.dumps(summary, indent=1))
