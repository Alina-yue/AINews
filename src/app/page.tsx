import { NewsGrid } from "@/components/NewsGrid";
import { RefreshNewsButton } from "@/components/RefreshNewsButton";
import { getLastRefreshTime, rssNewsProvider } from "@/services/news/rssProvider";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const articles = await rssNewsProvider.getLatestNews();
  const lastRefreshTime = (await getLastRefreshTime()) ?? "当前页实时生成";

  return (
    <main className="page">
      <header className="hero">
        <p className="hero-kicker">AI News Aggregator</p>
        <h1 className="hero-title">AI资讯聚合网站</h1>
        <p className="hero-desc">
          聚合量子位、InfoQ AI 和 OSCHINA AI 的资讯。页面优先展示脚本抓取并保存到 ai_news.json 的内容，缺失时自动回退到实时 RSS。
        </p>
        <p className="hero-meta">最后刷新时间：{lastRefreshTime}</p>
        <RefreshNewsButton />
      </header>

      <NewsGrid articles={articles} />
    </main>
  );
}
