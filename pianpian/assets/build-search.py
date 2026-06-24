# -*- coding: utf-8 -*-
"""
生成全站搜索索引 assets/search-index.json
读取 chapters/*.html，提取每章标题与正文段落。
段落顺序与浏览器中 .page-inner > p 的顺序一致，便于点击结果跳转到对应段落。
用法： python assets/build-search.py
"""
import os, re, json, html

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CH_DIR = os.path.join(ROOT, "chapters")
OUT = os.path.join(HERE, "search-index.json")

def clean(s):
    # <br/> 视为段内换行 -> 空格；去掉其它标签；反转义实体
    s = re.sub(r'(?i)<br\s*/?>', ' ', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s)
    return re.sub(r'\s+', ' ', s).strip()

def chapter_sort_key(fn):
    m = re.match(r'(\d+)([a-z]*)-(\d+)', fn)
    if not m:
        return (99, fn, 0)
    return (int(m.group(1)), m.group(2), int(m.group(3)))

entries = []
files = [f for f in os.listdir(CH_DIR) if f.endswith(".html")]
files.sort(key=chapter_sort_key)

for fn in files:
    path = os.path.join(CH_DIR, fn)
    with open(path, encoding="utf-8") as fh:
        doc = fh.read()
    # 标题：取 <title> 中 " · " 之前的部分
    mt = re.search(r'<title>(.*?)</title>', doc, re.S)
    title = clean(mt.group(1).split("·")[0]) if mt else fn
    # 正文：page-inner 里的所有 <p>...</p>，顺序与 DOM 一致
    mp = re.search(r'<div class="page-inner">(.*?)</div>', doc, re.S)
    body = mp.group(1) if mp else ""
    paras = [clean(p) for p in re.findall(r'<p[^>]*>(.*?)</p>', body, re.S)]
    paras = [p for p in paras if p]
    entries.append({"f": fn, "t": title, "p": paras})

with open(OUT, "w", encoding="utf-8") as fh:
    json.dump(entries, fh, ensure_ascii=False, separators=(",", ":"))

total = sum(len(e["p"]) for e in entries)
print("章节 %d，段落 %d，已写入 %s" % (len(entries), total, OUT))
