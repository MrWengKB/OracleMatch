#!/usr/bin/env python3
"""
从 hanzilist.csv（来自 HanziQuery）精简出 oraclelist.csv，并生成网页用的精简字体。

步骤：
  1. 用 check_oracle.py 的方法逐字检测方正甲骨文字体（FZ-oracle.ttf）里有没有这个字，
     简体找不到时改查对应的繁体字（如「马」→「馬」）。
  2. 只保留有甲骨文的字，写入 ../oraclelist.csv，栏位：年级,课次,生字,甲骨文字
  3. 只保留这些字，把甲骨文字体和楷体字体精简成 ../fonts/oracle.woff2、../fonts/kaiti.woff2
     （完整字体 15MB，精简后只有几百 KB，手机打开更快）。

用法（在 tools 文件夹里运行）：
  pip install fonttools brotli opencc-python-reimplemented
  python3 build_oraclelist.py

以后 HanziQuery 加了新字：把新的 hanzilist.csv 复制到 tools/ 再运行一次即可。
"""
import csv
import sys
from pathlib import Path

from fontTools import subset

from check_oracle import load_s2t_candidates, make_checker

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SRC_CSV = HERE / "hanzilist.csv"
ORACLE_FONT = HERE / "FZ-oracle.ttf"
KAITI_FONT = HERE / "kaiti.ttf"
TITLE_ORACLE = "甲骨文"   # 网页标题用甲骨文显示的字，也要放进精简字体
OUT_CSV = ROOT / "oraclelist.csv"
FONT_DIR = ROOT / "fonts"

GRADE_ORDER = "一二三四五六"
NUMS = {c: i for i, c in enumerate("零一二三四五六七八九十")}


def cn_num(s):
    """「第十二课」→ 12，用于排序。"""
    s = s.strip("第课")
    if not s:
        return 0
    if s == "十":
        return 10
    if s.startswith("十"):
        return 10 + NUMS.get(s[1], 0)
    if "十" in s:
        a, b = s.split("十")
        return NUMS.get(a, 0) * 10 + (NUMS.get(b, 0) if b else 0)
    return NUMS.get(s, 0)


def main():
    rows = list(csv.DictReader(SRC_CSV.open(encoding="utf-8-sig")))
    has = make_checker(ORACLE_FONT)
    s2t = load_s2t_candidates()

    out, seen = [], set()
    for r in rows:
        ch = r["生字"].strip()
        if len(ch) != 1 or ch in seen:
            continue
        show = ch if has(ch) else next((t for t in s2t.get(ch, []) if t != ch and has(t)), "")
        if not show:
            continue
        seen.add(ch)
        out.append({"年级": r["年级"].strip(), "课次": r["课次"].strip(), "生字": ch, "甲骨文字": show,
                    "_order": int(r.get("序号") or 0)})

    out.sort(key=lambda r: (GRADE_ORDER.find(r["年级"][0]), cn_num(r["课次"]), r["_order"]))
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["年级", "课次", "生字", "甲骨文字"], extrasaction="ignore")
        w.writeheader()
        w.writerows(out)
    print(f"oraclelist.csv：{len(out)} 字（hanzilist.csv 共 {len(rows)} 字）")

    FONT_DIR.mkdir(exist_ok=True)
    jobs = [(ORACLE_FONT, "oracle.woff2", TITLE_ORACLE + "".join(r["甲骨文字"] for r in out)),
            (KAITI_FONT, "kaiti.woff2", "".join(r["生字"] for r in out))]
    for src, name, text in jobs:
        dst = FONT_DIR / name
        opts = subset.Options()
        opts.flavor = "woff2"
        opts.layout_features = []
        opts.name_IDs = ["*"]
        opts.notdef_outline = True
        font = subset.load_font(str(src), opts)
        sub = subset.Subsetter(opts)
        sub.populate(text=text)
        sub.subset(font)
        subset.save_font(font, str(dst), opts)
        print(f"{name}：{dst.stat().st_size // 1024} KB")


if __name__ == "__main__":
    sys.exit(main())
