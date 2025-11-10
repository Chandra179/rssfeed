import { generateHash } from '../utils/hash';
import { Feed, Item } from "../types/index"

export const fetchFeed = async (url: string, fetchImages: boolean): Promise<{ feed: Partial<Feed>, items: Partial<Item>[] }> => {
  if (!url.startsWith('https://')) {
    throw new Error('Only HTTPS feeds are supported');
  }
  
  const response = await fetch(url, { mode: 'cors' });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('not_found');
    }
    throw new Error(`HTTP ${response.status}`);
  }
  
  const text = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');
  
  if (doc.querySelector('parsererror')) {
    throw new Error('malformed_xml');
  }
  
  const channel = doc.querySelector('channel, feed');
  if (!channel) {
    throw new Error('malformed_xml');
  }
  
  const feedTitle = channel.querySelector('title')?.textContent || 'Untitled Feed';
  const feedDescription = channel.querySelector('description, subtitle')?.textContent || '';
  
  const itemElements = Array.from(doc.querySelectorAll('item, entry'));
  const items: Partial<Item>[] = [];
  
  for (const itemEl of itemElements) {
    const title = itemEl.querySelector('title')?.textContent || 'Untitled';
    const link = itemEl.querySelector('link')?.textContent || 
                 itemEl.querySelector('link')?.getAttribute('href') || '';
    const pubDate = itemEl.querySelector('pubDate, published, updated')?.textContent || '';
    const content = itemEl.querySelector('content\\:encoded, content, description, summary')?.textContent || '';
    const author = itemEl.querySelector('author, creator, dc\\:creator')?.textContent || undefined;
    
    const sanitized = sanitizeHTML(content, fetchImages);
    const contentHash = await generateHash(link + title);
    
    const item: Partial<Item> = {
      title,
      link,
      publishedAt: pubDate ? new Date(pubDate).getTime() : Date.now(),
      content: sanitized,
      contentHash,
      author,
      read: false
    };
    
    item.sizeBytes = calculateSize(item);
    items.push(item);
  }
  
  return {
    feed: {
      title: feedTitle,
      description: feedDescription
    },
    items
  };
};

const calculateSize = (obj: any): number => {
  return new Blob([JSON.stringify(obj)]).size;
};

const sanitizeHTML = (html: string, fetchImages: boolean): string => {
  const DOMPurify = (window as any).DOMPurify;
  const config: any = {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li',
      'blockquote', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'img', 'figure', 'figcaption', 'video', 'iframe', 'div', 'span'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'title', 'width', 'height', 'loading', 'class', 'style'
    ],
    RETURN_TRUSTED_TYPE: false
  };
  
  if (fetchImages) {
    config.ALLOWED_TAGS.push('img');
    config.ALLOWED_ATTR.push('src', 'alt');
  }
  
  let output = DOMPurify.sanitize(html, config);
  output = output
    .replaceAll('<img ', '<img class="max-w-full h-auto mx-auto" loading="lazy" ')
    .replaceAll('<iframe ', '<iframe class="w-full aspect-video" ');

  return output;
};