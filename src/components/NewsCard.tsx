"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";

import { formatPublishTime } from "@/lib/date";
import { NewsItem } from "@/types/news";

type NewsCardProps = {
  article: NewsItem;
};

export function NewsCard({ article }: NewsCardProps) {
  const [isRead, setIsRead] = useState(false);

  useEffect(() => {
    const readArticles = localStorage.getItem("readArticles") || "[]";
    const readList = JSON.parse(readArticles);
    setIsRead(readList.includes(article.id));
  }, [article.id]);

  const handleClick = () => {
    const readArticles = localStorage.getItem("readArticles") || "[]";
    const readList = JSON.parse(readArticles);
    if (!readList.includes(article.id)) {
      readList.push(article.id);
      localStorage.setItem("readArticles", JSON.stringify(readList));
      setIsRead(true);
    }
  };

  return (
    <article className={`news-card ${isRead ? "news-card-read" : ""}`}>
      <div className="news-card-image-wrap">
        <Image
          src={article.imageUrl}
          alt={article.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="news-card-image"
        />
      </div>
      <div className="news-card-content">
        <p className="news-card-time">
          {article.source ? `${article.source} · ` : ""}
          {formatPublishTime(article.publishedAt, article.originalPublished)}
        </p>
        <h2 className="news-card-title">{article.title}</h2>
        <p className="news-card-summary">{article.summary}</p>
        <Link
          href={article.readMoreUrl}
          target="_blank"
          className="news-card-link"
          onClick={handleClick}
        >
          阅读更多
        </Link>
      </div>
    </article>
  );
}
