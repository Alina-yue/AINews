"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type RefreshApiResponse = {
  ok: boolean;
  message: string;
  error?: string;
};

export function RefreshNewsButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusText, setStatusText] = useState<string>("");

  const handleRefresh = async () => {
    setStatusText("正在抓取最新资讯，请稍候...");
    try {
      const response = await fetch("/api/refresh-news", { method: "POST" });
      const result = (await response.json()) as RefreshApiResponse;
      if (!response.ok || !result.ok) {
        setStatusText(result.error || result.message || "刷新失败，请稍后重试。");
        return;
      }

      setStatusText("刷新完成，正在更新页面...");
      startTransition(() => {
        router.refresh();
      });
      window.setTimeout(() => {
        setStatusText("刷新完成。若暂无新资讯，列表内容可能保持不变。");
      }, 1200);
    } catch {
      setStatusText("网络异常，刷新失败。");
    }
  };

  return (
    <div className="refresh-wrap">
      <button type="button" onClick={handleRefresh} disabled={isPending} className="refresh-btn">
        {isPending ? "刷新中..." : "一键刷新资讯"}
      </button>
      {statusText ? <p className="refresh-status">{statusText}</p> : null}
    </div>
  );
}
