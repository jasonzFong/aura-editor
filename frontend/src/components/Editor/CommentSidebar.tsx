import React, { useState } from 'react'

interface Comment {
  id: string;
  content: string;
  quote?: string;
  type?: string;
  reply?: any[]; // Updated to any[] for JSON structure, or specific interface
  created_at?: string;
}

interface CommentSidebarProps {
  comments: Comment[];
  resolvedComments: Comment[];
  activeCommentId?: string | null;
  onResolve: (id: string) => void;
  onReply: (id: string, content: string) => void;
  onActivate?: (id: string) => void;
}

const formatTime = (isoString?: string) => {
    // ... existing implementation
    if (!isoString) return 'Just now';
    const date = new Date(isoString.endsWith('Z') ? isoString : isoString + 'Z');
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) {
        return 'Just now';
    } else if (diffMins < 60) {
        return `${diffMins} mins ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hours ago`;
    } else {
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

const CommentSidebar = ({ comments, resolvedComments = [], activeCommentId, onResolve, onReply, onActivate }: CommentSidebarProps) => {
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({}) // Track loading state for each comment
  const [activeTab, setActiveTab] = useState<'open' | 'resolved'>('open')
  const commentRefs = React.useRef<Record<string, HTMLDivElement | null>>({})

  // Filter out NO_COMMENT items
  const validComments = comments.filter(c => {
      const content = c.content || ''
      return !content.toUpperCase().includes('NO_COMMENT') && content.trim() !== ''
  })
  const validResolvedComments = resolvedComments.filter(c => {
      const content = c.content || ''
      return !content.toUpperCase().includes('NO_COMMENT') && content.trim() !== ''
  })

  // Scroll to active comment
  React.useEffect(() => {
      if (activeCommentId && commentRefs.current[activeCommentId]) {
          commentRefs.current[activeCommentId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
  }, [activeCommentId])

  const handleReplySubmit = async (id: string) => {
      if (!replyText[id]?.trim() || loadingReplies[id]) return;
      
      const content = replyText[id];
      setReplyText(prev => ({ ...prev, [id]: '' })); // Clear input immediately
      setLoadingReplies(prev => ({ ...prev, [id]: true })); // Set loading
      
      try {
          await onReply(id, content);
      } finally {
          setLoadingReplies(prev => ({ ...prev, [id]: false }));
      }
  }

  const renderComment = (c: Comment, isResolved: boolean = false) => {
    // Filter is done at component level, so no need to check here again
    return (
    <div 
        key={c.id} 
        ref={(el) => {
            if (el) commentRefs.current[c.id] = el
        }}
        className={`bg-white p-3 rounded-lg shadow-sm transition mb-3 cursor-pointer border-2 ${activeCommentId === c.id ? 'border-blue-500' : 'border-transparent hover:shadow-md'}`}
        onClick={(e) => {
            // Prevent activation if clicking on input, button or link
            if ((e.target as HTMLElement).closest('input, button, a')) return;
            onActivate && onActivate(c.id);
        }}
    >
        <div className="flex justify-between items-start mb-1">
            <div className="text-xs font-bold text-blue-600 uppercase tracking-wide">Comment</div>
            <div className="text-[10px] text-gray-400">{formatTime(c.created_at)}</div>
        </div>
        {c.quote && c.quote !== 'NONE' && <div className="text-xs italic text-gray-500 mb-2 border-l-2 border-blue-200 pl-2 line-clamp-2">"{c.quote}"</div>}
        <div className="text-sm text-gray-800 whitespace-pre-wrap">{c.content}</div>
        
        {/* Thread View */}
        {c.reply && Array.isArray(c.reply) && c.reply.length > 0 && (
            <div className="mt-3 bg-gray-50 p-2 rounded text-xs space-y-2 border-l-2 border-gray-300">
                {c.reply.map((msg: any, idx: number) => (
                    <div key={idx} className="flex flex-col gap-0.5">
                        <div className={`font-semibold text-[10px] ${msg.role === 'ai' ? 'text-blue-600' : 'text-gray-700'}`}>
                            {msg.role === 'ai' ? 'AI Assistant' : 'You'}
                        </div>
                        <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {msg.content}
                        </div>
                    </div>
                ))}
            </div>
        )}
        
        {/* Loading Indicator */}
        {loadingReplies[c.id] && (
            <div className="mt-3 bg-gray-50 p-2 rounded text-xs border-l-2 border-gray-300 flex items-center gap-2 text-gray-500">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                AI is thinking...
            </div>
        )}

        {!isResolved && (
            <div className="mt-3 flex flex-col gap-2">
                <input 
                    className="text-xs border rounded p-1.5 w-full outline-none focus:border-blue-400 disabled:bg-gray-100"
                    placeholder="Reply to AI..."
                    value={replyText[c.id] || ''}
                    onChange={(e) => setReplyText(prev => ({ ...prev, [c.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleReplySubmit(c.id)}
                    disabled={loadingReplies[c.id]}
                />
                <div className="flex justify-between items-center">
                    <button 
                        onClick={() => handleReplySubmit(c.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!replyText[c.id]?.trim() || loadingReplies[c.id]}
                    >
                        Reply
                    </button>
                    <button 
                        onClick={() => onResolve(c.id)}
                        className="text-xs text-gray-400 hover:text-green-600 flex items-center gap-1 transition"
                    >
                        Resolve
                    </button>
                </div>
            </div>
        )}
    </div>
  )
  }

  return (
    <div className="bg-gray-50 p-4 h-full overflow-y-auto flex-shrink-0 w-80 flex flex-col">
      <h3 className="font-bold mb-4 text-gray-700 flex items-center gap-2">
        <span>✨ Comments</span>
      </h3>
      
      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b pb-2">
          <button 
            onClick={() => setActiveTab('open')}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${activeTab === 'open' ? 'bg-white shadow-sm text-blue-600 font-medium' : 'text-gray-500 hover:bg-gray-200'}`}
          >
              Open <span className="bg-gray-200 px-1.5 rounded-full text-[10px] text-gray-600">{validComments.length}</span>
          </button>
          <button 
            onClick={() => setActiveTab('resolved')}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${activeTab === 'resolved' ? 'bg-white shadow-sm text-blue-600 font-medium' : 'text-gray-500 hover:bg-gray-200'}`}
          >
              Resolved <span className="bg-gray-200 px-1.5 rounded-full text-[10px] text-gray-600">{validResolvedComments.length}</span>
          </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'open' ? (
            <>
                {validComments.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                        <p>No open comments.</p>
                        <p className="text-xs mt-1">AI is analyzing your text...</p>
                    </div>
                )}
                {validComments.map(c => renderComment(c, false))}
            </>
        ) : (
            <>
                {validResolvedComments.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                        <p>No resolved comments.</p>
                    </div>
                )}
                {validResolvedComments.map(c => renderComment(c, true))}
            </>
        )}
      </div>
    </div>
  )
}

export default CommentSidebar
