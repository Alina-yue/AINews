export function parseDate(dateStr: string): string {
  if (!dateStr) {
    return new Date().toISOString();
  }

  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch (e) {
    console.log('Date parsing error:', e);
  }

  const rfc2822Regex = /(\w{3}), (\d{2}) (\w{3}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) (\+|-)(\d{4})/;
  const match = dateStr.match(rfc2822Regex);
  if (match) {
    const day = match[2];
    const month = match[3];
    const year = match[4];
    const hours = match[5];
    const minutes = match[6];
    const seconds = match[7];
    
    const monthMap: Record<string, number> = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    
    const monthNum = monthMap[month];
    if (monthNum !== undefined) {
      const date = new Date(Date.UTC(parseInt(year), monthNum, parseInt(day), parseInt(hours), parseInt(minutes), parseInt(seconds)));
      return date.toISOString();
    }
  }

  const simpleDateRegex = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/;
  const simpleMatch = dateStr.match(simpleDateRegex);
  if (simpleMatch) {
    return dateStr;
  }

  const dateTimeRegex = /(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?/;
  const dateTimeMatch = dateStr.match(dateTimeRegex);
  if (dateTimeMatch) {
    const seconds = dateTimeMatch[6] || '00';
    return `${dateTimeMatch[1]}-${dateTimeMatch[2]}-${dateTimeMatch[3]}T${dateTimeMatch[4]}:${dateTimeMatch[5]}:${seconds}Z`;
  }

  return new Date().toISOString();
}

export function formatPublishTime(isoString: string, originalPublished?: string): string {
  if (originalPublished && originalPublished.trim()) {
    const parsedDate = parseOriginalDate(originalPublished);
    if (parsedDate) {
      return parsedDate;
    }
  }
  
  const date = new Date(isoString);
  
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function parseOriginalDate(dateStr: string): string | null {
  const patterns = [
    /(\d{4})[\-/](\d{1,2})[\-/](\d{1,2})\s+(\d{1,2}):(\d{2})(?::\d{2})?/,
    /(\d{4})[\-/](\d{1,2})[\-/](\d{1,2})/,
  ];
  
  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      const year = match[1];
      const month = String(parseInt(match[2])).padStart(2, "0");
      const day = String(parseInt(match[3])).padStart(2, "0");
      if (match[4] && match[5]) {
        const hour = String(parseInt(match[4])).padStart(2, "0");
        const minute = match[5];
        return `${year}-${month}-${day} ${hour}:${minute}`;
      }
      return `${year}-${month}-${day} 00:00`;
    }
  }
  
  const rfcPattern = /(\d{2})\s+(\w+)\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/;
  const rfcMatch = dateStr.match(rfcPattern);
  if (rfcMatch) {
    const months: { [key: string]: string } = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
      'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    const day = rfcMatch[1];
    const month = months[rfcMatch[2]] || '01';
    const year = rfcMatch[3];
    const hour = rfcMatch[4];
    const minute = rfcMatch[5];
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }
  
  return null;
}
