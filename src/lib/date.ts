export function formatPublishTime(isoString: string, originalPublished?: string): string {
  const date = new Date(isoString);
  
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}
