import { ArrowLeft } from 'lucide-react';
import { Item } from '../types/index';
import { useState, useEffect, useRef } from 'react';

const ArticleView: React.FC<{
  item: Item | null;
  onToggleRead: (item: Item) => void;
  onBack: () => void;
}> = ({ item, onToggleRead, onBack }) => {
  const [useIframe, setUseIframe] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Reset iframe state when item changes
    setUseIframe(true);
    setIframeError(false);
    
    // Set a timeout to detect if iframe fails to load
    const timeoutId = setTimeout(() => {
      if (useIframe && !iframeError) {
        // If iframe hasn't loaded after 2 seconds, assume it failed
        setIframeError(true);
        setUseIframe(false);
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [item?.id]);

  useEffect(() => {
    // Check if iframe loaded successfully
    if (iframeRef.current && useIframe) {
      const iframe = iframeRef.current;
      
      const handleLoad = () => {
        try {
          // Try to access iframe content to detect X-Frame-Options errors
          iframe.contentWindow?.document;
        } catch (e) {
          // Cross-origin or X-Frame-Options blocked
          setIframeError(true);
          setUseIframe(false);
        }
      };
      
      iframe.addEventListener('load', handleLoad);
      return () => iframe.removeEventListener('load', handleLoad);
    }
  }, [useIframe, item?.id]);

  if (!item) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center px-4">
          <p className="text-lg mb-2">No post selected</p>
          <p className="text-sm">Open a post in the list to the left</p>
          <p className="text-sm">to begin consuming feeds</p>
        </div>
      </div>
    );
  }

  const handleIframeError = () => {
    setIframeError(true);
    setUseIframe(false);
  };

  // Try to use iframe first, fallback to HTML content if it fails
  if (useIframe && !iframeError) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b md:hidden">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-blue-500 hover:text-blue-600"
          >
            <ArrowLeft size={20} />
            <span>Back to list</span>
          </button>
        </div>
        <iframe
          ref={iframeRef}
          src={item.link}
          className="flex-1 w-full border-0"
          title={item.title}
          onError={handleIframeError}
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    );
  }

  // Fallback to HTML content
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 md:p-6 border-b">
        <button
          onClick={onBack}
          className="flex md:hidden items-center gap-2 text-blue-500 mb-4 hover:text-blue-600"
        >
          <ArrowLeft size={20} />
          <span>Back to list</span>
        </button>
        <h1 className="text-xl md:text-2xl font-bold mb-3">{item.title}</h1>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm text-gray-500">
          <div>
            {item.author && <span>{item.author} · </span>}
            <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
          </div>
          <button
            onClick={() => onToggleRead(item)}
            className={`px-3 py-1 text-sm rounded whitespace-nowrap ${item.read ? 'bg-gray-200' : 'bg-blue-500 text-white'}`}
          >
            {item.read ? 'Mark Unread' : 'Mark Read'}
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div 
          className="prose prose-sm sm:prose-base max-w-none mb-6 break-words"
          dangerouslySetInnerHTML={{ __html: item.content }}
        />
        
        <a 
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Read full article →
        </a>
      </div>
    </div>
  );
};

export default ArticleView;