"""Ekstrak baris-baris teknis (kode/sintaks/fakta) dari teks materi penuh."""
import json
import os
import re

IN = r"C:/Users/erlan/Documents/ops-edu-quiz/data/material-texts"
OUT = r"C:/Users/erlan/Documents/ops-edu-quiz/data/material-tech"
os.makedirs(OUT, exist_ok=True)

courses = [
    "python-start-1st-year",
    "python-start-2nd-year",
    "python-pro-2nd-year",
    "visual-programming",
]

CODE_RE = re.compile(
    r"(def |import |from .+ import|print\(|input\(|for .+ in |while |if .+:|elif |else:|"
    r"class |return |= |random\.|time\.|turtle|Turtle|pygame|PyQt|pandas|try:|except|"
    r"open\(|\.read|\.write|forward|backward|left\(|right\(|goto|setx|sety|glide|"
    r"broadcast|when .+ clicked|repeat|forever|variable|clone|touching|list|dictionary)",
    re.IGNORECASE,
)

for course in courses:
    with open(os.path.join(IN, course + ".json"), encoding="utf-8") as f:
        docs = json.load(f)
    out = []
    for doc in docs:
        lines = []
        seen = set()
        for raw in doc.get("text", "").split("\n"):
            line = raw.strip()
            if len(line) < 4 or len(line) > 160:
                continue
            if CODE_RE.search(line):
                key = line.lower()
                if key in seen:
                    continue
                seen.add(key)
                lines.append(line)
            if len(lines) >= 30:
                break
        out.append({"file": doc["file"], "tech": lines})
    with open(os.path.join(OUT, course + ".json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    n = sum(len(o["tech"]) for o in out)
    print(course, "->", len(out), "files,", n, "tech lines")
