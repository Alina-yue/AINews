#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dependencies:
  pip install feedparser
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple

import feedparser


RSS_SOURCES: Dict[str, List[str]] = {
    "量子位": ["https://www.qbitai.com/feed"],
    "InfoQ AI": ["https://www.infoq.cn/feed?tag=AI"],
    "OSCHINA AI": ["https://www.oschina.net/news/rss/ai"],
}

OUTPUT_FILE = Path("ai_news.json")
META_FILE = Path("ai_news_meta.json")
REQUEST_INTERVAL_SECONDS = 1.5
MAX_PER_SOURCE = 10
SOURCE_LINK_PREFIXES: Dict[str, List[str]] = {}


def load_existing_news(file_path: Path) -> List[dict]:
    if not file_path.exists():
        return []
    try:
        with file_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            print("[WARN] 现有 ai_news.json 格式不是列表，将忽略旧数据。")
            return []
    except Exception as exc:
        print(f"[WARN] 读取 ai_news.json 失败，将从空数据开始: {exc}")
        return []


def build_unique_keys(items: List[dict]) -> set:
    keys = set()
    for item in items:
        link = (item.get("link") or "").strip()
        title = (item.get("title") or "").strip()
        source = (item.get("source") or "").strip()
        if link:
            keys.add(("link", link))
        else:
            keys.add(("fallback", f"{source}|{title}"))
    return keys


def normalize_entry(entry, source_name: str) -> dict:
    title = getattr(entry, "title", "").strip()
    link = getattr(entry, "link", "").strip()
    published = getattr(entry, "published", "").strip() or getattr(
        entry, "updated", ""
    ).strip()
    summary = getattr(entry, "summary", "").strip() or getattr(
        entry, "description", ""
    ).strip()

    return {
        "title": title,
        "link": link,
        "published": published,
        "summary": summary,
        "source": source_name,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


def fetch_source(source_name: str, rss_urls: List[str]) -> Tuple[List[dict], str, str]:
    errors: List[str] = []

    for rss_url in rss_urls:
        try:
            feed = feedparser.parse(rss_url)
            if getattr(feed, "bozo", False):
                bozo_exc = getattr(feed, "bozo_exception", None)
                errors.append(f"{rss_url} -> RSS 解析异常: {bozo_exc}")
                continue

            entries = getattr(feed, "entries", [])
            normalized = [
                normalize_entry(entry, source_name) for entry in entries[:MAX_PER_SOURCE]
            ]
            prefixes = SOURCE_LINK_PREFIXES.get(source_name, [])
            if prefixes:
                lowered_prefixes = [p.lower() for p in prefixes]
                filtered: List[dict] = []
                for item in normalized:
                    link = str(item.get("link", "")).strip().lower()
                    if any(link.startswith(prefix) for prefix in lowered_prefixes):
                        filtered.append(item)
                normalized = filtered

            if normalized:
                return normalized, "", rss_url

            errors.append(f"{rss_url} -> 无可用条目")
        except Exception as exc:
            errors.append(f"{rss_url} -> 抓取异常: {exc}")

    return [], " | ".join(errors), ""


def save_news(file_path: Path, items: List[dict]) -> None:
    with file_path.open("w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def save_meta(file_path: Path) -> str:
    refreshed_at = datetime.now(timezone.utc).isoformat()
    payload = {"last_refreshed_at": refreshed_at}
    with file_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return refreshed_at


def main() -> None:
    print("=== AI资讯自动抓取开始 ===")
    print(f"目标信源数量: {len(RSS_SOURCES)}")
    print(f"抓取间隔: {REQUEST_INTERVAL_SECONDS}s/源（降低访问压力）")
    print(f"每个源最多抓取: {MAX_PER_SOURCE} 条")
    print("-" * 60)

    existing_news = load_existing_news(OUTPUT_FILE)
    unique_keys = build_unique_keys(existing_news)
    all_news = list(existing_news)

    total_success = 0
    total_fail = 0
    total_new = 0

    for index, (source_name, rss_urls) in enumerate(RSS_SOURCES.items(), start=1):
        print(f"[{index}/{len(RSS_SOURCES)}] 正在抓取: {source_name}")
        entries, error, used_url = fetch_source(source_name, rss_urls)
        if error:
            total_fail += 1
            print(f"  [FAIL] {source_name} 抓取失败: {error}")
            print("  [TIP] 该RSS源可能暂时不可访问或被限制，请稍后重试。")
        else:
            total_success += 1
            source_new_count = 0
            for entry in entries:
                link = (entry.get("link") or "").strip()
                if link:
                    key = ("link", link)
                else:
                    title = (entry.get("title") or "").strip()
                    key = ("fallback", f"{source_name}|{title}")
                if key in unique_keys:
                    continue
                unique_keys.add(key)
                all_news.append(entry)
                source_new_count += 1

            total_new += source_new_count
            print(
                f"  [OK] {source_name} 抓取 {len(entries)} 条，新增 {source_new_count} 条。"
            )
            if used_url:
                print(f"  [SRC] 使用源: {used_url}")

        # 控制抓取频率，避免对目标网站造成过大压力
        if index < len(RSS_SOURCES):
            time.sleep(REQUEST_INTERVAL_SECONDS)

    save_news(OUTPUT_FILE, all_news)
    refreshed_at = save_meta(META_FILE)

    print("-" * 60)
    print("=== 抓取完成 ===")
    print(f"成功源: {total_success} | 失败源: {total_fail}")
    print(f"新增资讯: {total_new} | 当前总量: {len(all_news)}")
    print(f"输出文件: {OUTPUT_FILE.resolve()}")
    print(f"刷新时间文件: {META_FILE.resolve()} ({refreshed_at})")


if __name__ == "__main__":
    main()
