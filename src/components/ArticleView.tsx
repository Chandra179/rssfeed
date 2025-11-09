const ArticleView: React.FC<{
  item: Item | null;
  onToggleRead: (item: Item) => void;
}> = ({ item, onToggleRead }) => {
  if (!item) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">No post selected</p>
          <p className="text-sm">Open a post in the bar to the left</p>
          <p className="text-sm">to begin consuming feeds</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold mb-3">{item.title}</h1>
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div>
            {item.author && <span>{item.author} · </span>}
            <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
          </div>
          <button
            onClick={() => onToggleRead(item)}
            className={`px-3 py-1 text-sm rounded ${item.read ? 'bg-gray-200' : 'bg-blue-500 text-white'}`}
          >
            {item.read ? 'Mark Unread' : 'Mark Read'}
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        <div 
          className="prose prose-sm max-w-none mb-6"
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
    </>
  );
};

export default ArticleView;