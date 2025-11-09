export interface Feed {
  id: string;
  url: string;
  title: string;
  description: string;
  lastFetchedAt: number;
  lastFetchStatus: 'success' | 'cors_error' | 'not_found' | 'malformed_xml' | 'timeout';
  lastFetchError: string | null;
  totalSizeBytes: number;
  settings: {
    fetchImages: boolean;
    maxSizeBytes: number;
  };
}

export interface Item {
  id: string;
  feedId: string;
  title: string;
  link: string;
  publishedAt: number;
  content: string;
  read: boolean;
  contentHash: string;
  author?: string;
  sizeBytes: number;
}