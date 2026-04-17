import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { parseDate } from '@/lib/date';

interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  pubDate: string;
  imageUrl: string;
  description: string;
}

const DEFAULT_IMAGE = 'https://neeko-copilot.bytedance.net/api/text_to_image?prompt=AI%20technology%20news%20abstract%20background&image_size=landscape_16_9';

const SOURCES = [
  { name: '量子位', url: 'https://www.qbitai.com/feed' },
  { name: 'InfoQ AI', url: 'https://www.infoq.cn/feed/topic/71' },
  { name: 'OSCHINA AI', url: 'https://www.oschina.net/feed/topic/ai' },
];

async function fetchRSS(url: string, sourceName: string): Promise<NewsItem[]> {
  try {
    const response = await axios.get(url, { timeout: 15000 });
    const xml = response.data;
    const $ = cheerio.load(xml, { xmlMode: true });
    const items: NewsItem[] = [];

    $('item').each((_, element) => {
      const title = $(element).find('title').text().trim();
      const link = $(element).find('link').text().trim();
      const pubDate = $(element).find('pubDate').text().trim();
      const description = $(element).find('description').text().trim();
      
      let imageUrl = '';
      const contentEncoded = $(element).find('content\\:encoded, encoded').text();
      if (contentEncoded) {
        const imgMatch = contentEncoded.match(/<img[^>]+src="([^"]+)"/);
        if (imgMatch) {
          imageUrl = imgMatch[1];
        }
      }
      if (!imageUrl) {
        const descMatch = description.match(/<img[^>]+src="([^"]+)"/);
        if (descMatch) {
          imageUrl = descMatch[1];
        }
      }

      const parsedDate = parseDate(pubDate);

      items.push({
        id: `${sourceName}-${link}`,
        title,
        link,
        source: sourceName,
        pubDate: parsedDate,
        imageUrl: imageUrl || DEFAULT_IMAGE,
        description,
      });
    });

    return items;
  } catch (error) {
    console.error(`Failed to fetch ${sourceName}:`, error);
    return [];
  }
}

export async function POST() {
  try {
    const allNews: NewsItem[] = [];
    const startTime = Date.now();

    for (const source of SOURCES) {
      const news = await fetchRSS(source.url, source.name);
      allNews.push(...news);
    }

    allNews.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    const elapsed = Date.now() - startTime;
    console.log(`Fetched ${allNews.length} news items in ${elapsed}ms`);

    return NextResponse.json({
      ok: true,
      message: `刷新成功！共获取 ${allNews.length} 条资讯`,
      articles: allNews,
      lastRefreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error refreshing news:', error);
    return NextResponse.json({
      ok: false,
      message: '刷新失败',
      error: '服务器内部错误，请稍后重试',
    }, { status: 500 });
  }
}
