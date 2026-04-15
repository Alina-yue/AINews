#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dependencies:
  pip install feedparser
"""

from __future__ import annotations

import json
import re
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, List, Tuple

import feedparser


RSS_SOURCES: Dict[str, List[str]] = {
    "量子位": ["https://www.qbitai.com/feed"],
    "InfoQ AI": ["https://www.infoq.cn/feed?tag=AI"],
    "OSCHINA AI": ["https://www.oschina.net/news/rss/ai"],
}

TARGET_COUNTS: Dict[str, int] = {
    "量子位": 4,
    "InfoQ AI": 3,
    "OSCHINA AI": 3,
}

OUTPUT_FILE = Path("ai_news.json")
META_FILE = Path("ai_news_meta.json")
REQUEST_INTERVAL_SECONDS = 1.5
MAX_FETCH_PER_SOURCE = 50
DAYS_TO_FETCH = 7
DAYS_TO_FALLBACK = 30


MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    "一月": 1, "二月": 2, "三月": 3, "四月": 4, "五月": 5, "六月": 6,
    "七月": 7, "八月": 8, "九月": 9, "十月": 10, "十一月": 11, "十二月": 12,
}


def parse_date_string(date_str: str) -> datetime | None:
    if not date_str:
        return None
    
    date_str = date_str.strip()
    
    formats = [
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%a, %d %b %Y %H:%M:%S %z",
        "%d %b %Y %H:%M:%S %Z",
        "%Y-%m-%d",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d",
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    
    try:
        if date_str.endswith('Z'):
            date_str = date_str[:-1] + '+00:00'
            return datetime.fromisoformat(date_str)
    except ValueError:
        pass
    
    match = re.match(
        r'(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?',
        date_str
    )
    if match:
        groups = match.groups()
        try:
            year = int(groups[0])
            month = int(groups[1])
            day = int(groups[2])
            hour = int(groups[3]) if groups[3] else 0
            minute = int(groups[4]) if groups[4] else 0
            second = int(groups[5]) if groups[5] else 0
            return datetime(year, month, day, hour, minute, second, tzinfo=timezone.utc)
        except ValueError:
            pass
    
    return None


def load_existing_news(file_path: Path) -> List[dict]:
    if not file_path.exists():
        return []
    try:
        with file_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            return []
    except Exception:
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


def parse_published_date(published_str: str, source_name: str) -> str:
    if not published_str:
        return datetime.now(timezone.utc).isoformat()
    
    parsed_date = parse_date_string(published_str)
    if parsed_date:
        return parsed_date.isoformat()
    
    print(f"[WARN] 解析日期失败 ({source_name}): {published_str}")
    return datetime.now(timezone.utc).isoformat()


def is_recent_date(published_iso: str, days: int) -> bool:
    try:
        published_date = datetime.fromisoformat(published_iso.replace("Z", "+00:00"))
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        return published_date >= cutoff_date
    except Exception:
        return True


def normalize_entry(entry, source_name: str) -> dict:
    title = getattr(entry, "title", "").strip()
    link = getattr(entry, "link", "").strip()
    published = getattr(entry, "published", "").strip() or getattr(
        entry, "updated", ""
    ).strip()
    
    summary = getattr(entry, "summary", "").strip() or getattr(
        entry, "description", ""
    ).strip()
    
    parsed_published = parse_published_date(published, source_name)
    
    return {
        "title": title,
        "link": link,
        "published": published,
        "published_iso": parsed_published,
        "summary": summary,
        "source": source_name,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


def fetch_source(source_name: str, rss_urls: List[str], days_limit: int) -> List[dict]:
    all_entries: List[dict] = []
    
    for rss_url in rss_urls:
        try:
            feed = feedparser.parse(rss_url)
            if getattr(feed, "bozo", False):
                bozo_exc = getattr(feed, "bozo_exception", None)
                print(f"[WARN] RSS解析异常 ({source_name}): {bozo_exc}")
                continue

            entries = getattr(feed, "entries", [])
            normalized = [
                normalize_entry(entry, source_name) for entry in entries[:MAX_FETCH_PER_SOURCE]
            ]
            
            recent_entries = [e for e in normalized if is_recent_date(e["published_iso"], days_limit)]
            all_entries.extend(recent_entries)
                
        except Exception as exc:
            print(f"[WARN] 抓取异常 ({source_name}): {exc}")

    return all_entries


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
    print(f"目标信源: {list(RSS_SOURCES.keys())}")
    print(f"目标数量: 共10条 (量子位4条, InfoQ AI 3条, OSCHINA AI 3条)")
    print("-" * 60)

    existing_news = load_existing_news(OUTPUT_FILE)
    unique_keys = build_unique_keys(existing_news)
    all_news = list(existing_news)
    
    print(f"现有新闻数量: {len(existing_news)}")

    all_candidates: List[dict] = []
    new_entries: List[dict] = []

    for index, (source_name, rss_urls) in enumerate(RSS_SOURCES.items(), start=1):
        print(f"[{index}/{len(RSS_SOURCES)}] 正在抓取 {source_name}")
        
        entries = fetch_source(source_name, rss_urls, DAYS_TO_FALLBACK)
        print(f"  [OK] {source_name} 抓取到 {len(entries)} 条候选新闻")
        
        for entry in entries:
            link = (entry.get("link") or "").strip()
            if link:
                key = ("link", link)
            else:
                title = (entry.get("title") or "").strip()
                key = ("fallback", f"{source_name}|{title}")
            
            if key not in unique_keys:
                all_candidates.append(entry)
                unique_keys.add(key)
        
        if index < len(RSS_SOURCES):
            time.sleep(REQUEST_INTERVAL_SECONDS)

    all_candidates.sort(key=lambda x: x.get("published_iso", ""), reverse=True)
    
    source_counts: Dict[str, int] = {k: 0 for k in RSS_SOURCES.keys()}
    
    for entry in all_candidates:
        source = entry.get("source", "")
        target = TARGET_COUNTS.get(source, 3)
        
        if source_counts[source] < target:
            if is_recent_date(entry["published_iso"], DAYS_TO_FETCH):
                new_entries.append(entry)
                source_counts[source] += 1
            elif len(new_entries) < 10:
                print(f"[INFO] {source} 新新闻不足，使用历史新闻")
                new_entries.append(entry)
                source_counts[source] += 1
        
        if len(new_entries) >= 10:
            break
    
    if len(new_entries) < 10:
        for entry in all_candidates:
            source = entry.get("source", "")
            if source_counts[source] < TARGET_COUNTS.get(source, 3) * 2:
                if entry not in new_entries:
                    new_entries.append(entry)
                    source_counts[source] += 1
            if len(new_entries) >= 10:
                break

    all_news.extend(new_entries)
    all_news.sort(key=lambda x: x.get("published_iso", ""), reverse=True)

    save_news(OUTPUT_FILE, all_news)
    refreshed_at = save_meta(META_FILE)

    print("-" * 60)
    print("=== 抓取完成 ===")
    print(f"本次新增: {len(new_entries)} 条")
    print(f"  - 量子位: {source_counts.get('量子位', 0)} 条")
    print(f"  - InfoQ AI: {source_counts.get('InfoQ AI', 0)} 条")
    print(f"  - OSCHINA AI: {source_counts.get('OSCHINA AI', 0)} 条")
    print(f"当前总量: {len(all_news)} 条")
    print(f"输出文件: {OUTPUT_FILE.resolve()}")
    print(f"刷新时间: {refreshed_at}")
    
    print(f"##RESULT## new_count={len(new_entries)} total_count={len(all_news)}")


if __name__ == "__main__":
    main()
