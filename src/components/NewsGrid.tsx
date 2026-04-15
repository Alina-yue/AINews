"use client";

import { useState } from "react";

import { NewsCard } from "@/components/NewsCard";
import { NewsItem } from "@/types/news";

type NewsGridProps = {
  articles: NewsItem[];
};

const PAGE_SIZE = 6;

export function NewsGrid({ articles }: NewsGridProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(articles.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const displayedArticles = articles.slice(startIndex, endIndex);

  const handlePrev = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
  };

  const renderPageNumbers = () => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageClick(i)}
          className={`pagination-item ${i === currentPage ? "pagination-item-active" : ""}`}
          disabled={i === currentPage}
        >
          {i}
        </button>
      );
    }
    return pages;
  };

  return (
    <div className="news-grid-wrapper">
      <section className="news-grid" aria-label="AI资讯列表">
        {displayedArticles.map((article) => (
          <NewsCard key={article.id} article={article} />
        ))}
      </section>

      {totalPages > 1 && (
        <nav className="pagination" aria-label="新闻分页">
          <button
            className="pagination-btn"
            onClick={handlePrev}
            disabled={currentPage === 1}
            aria-label="上一页"
          >
            ←
          </button>
          <div className="pagination-items">
            {renderPageNumbers()}
          </div>
          <button
            className="pagination-btn"
            onClick={handleNext}
            disabled={currentPage === totalPages}
            aria-label="下一页"
          >
            →
          </button>
        </nav>
      )}
    </div>
  );
}
