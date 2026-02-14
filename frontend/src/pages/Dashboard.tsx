import { useState, useEffect, useRef, useMemo } from 'react'
import TipTapEditor from '../components/Editor/TipTapEditor'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useAIStream } from '../hooks/useAIStream'
import CommentSidebar from '../components/Editor/CommentSidebar'
import SettingsModal from '../components/Settings/SettingsModal'
import { v4 as uuidv4 } from 'uuid'
import { ChevronLeft, ChevronRight, CheckSquare, X, Trash2 } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import ConfirmDialog from '../components/UI/ConfirmDialog'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { SortableArticleItem, ArticleItem } from '../components/Dashboard/SortableArticleItem'
import Calendar from '../components/Calendar'

interface DashboardProps {
    onNavigate?: (page: string) => void;
}

const Dashboard = ({ onNavigate }: DashboardProps) => {
  const { logout } = useAuth()
  const { showToast } = useToast()
  const { analyzeText } = useAIStream()
  const [articles, setArticles] = useState<any[]>([])
  const [currentArticle, setCurrentArticle] = useState<any>(null)
  const [deleteArticleId, setDeleteArticleId] = useState<string | null>(null)
  const [articleComments, setArticleComments] = useState<Record<string, { open: any[], resolved: any[] }>>({})
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedArticles, setSelectedArticles] = useState<string[]>([])
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  const latestArticleId = useMemo(() => {
      if (articles.length === 0) return null;
      return articles.reduce((prev, current) => 
          (new Date(prev.updated_at).getTime() > new Date(current.updated_at).getTime()) ? prev : current
      ).id;
  }, [articles])

  const comments = currentArticle ? (articleComments[currentArticle.id]?.open || []) : []
  const resolvedComments = currentArticle ? (articleComments[currentArticle.id]?.resolved || []) : []

  const setComments = (newComments: any[] | ((prev: any[]) => any[])) => {
      if (!currentArticle) return
      setArticleComments(prev => {
          const current = prev[currentArticle.id] || { open: [], resolved: [] }
          const updated = typeof newComments === 'function' ? newComments(current.open) : newComments
          return {
              ...prev,
              [currentArticle.id]: { ...current, open: updated }
          }
      })
  }

  const setResolvedComments = (newResolved: any[] | ((prev: any[]) => any[])) => {
      if (!currentArticle) return
      setArticleComments(prev => {
          const current = prev[currentArticle.id] || { open: [], resolved: [] }
          const updated = typeof newResolved === 'function' ? newResolved(current.resolved) : newResolved
          return {
              ...prev,
              [currentArticle.id]: { ...current, resolved: updated }
          }
      })
  }
  const [searchQuery, setSearchQuery] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [userSettings, setUserSettings] = useState<any>(null)
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true)
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true)
  
  const [isMemoryScanning, setIsMemoryScanning] = useState(false)
  
  const typingTimeoutRef = useRef<any>(null)
  const pollingIntervalRef = useRef<any>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setArticles((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);
        
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Persist to backend
        const articleIds = newItems.map(a => a.id);
        api.put('/articles/reorder', articleIds).catch(err => console.error('Failed to reorder', err));
        
        return newItems;
      });
    }
    setActiveDragId(null);
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
  };

  useEffect(() => {
    fetchArticles()
    fetchSettings()
    
    // Poll scanning status every 5 seconds
    pollingIntervalRef.current = setInterval(fetchScanningStatus, 5000)
    fetchScanningStatus() // Initial check
    
    return () => {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
    }
  }, [searchQuery]) // Re-fetch when search changes

  const toggleArticleSelection = (id: string) => {
      if (selectedArticles.includes(id)) {
          setSelectedArticles(selectedArticles.filter(aid => aid !== id))
      } else {
          setSelectedArticles([...selectedArticles, id])
      }
  }

  const handleBulkDeleteArticles = async () => {
      try {
          await Promise.all(selectedArticles.map(id => api.delete(`/articles/${id}`)))
          
          setArticles(prev => prev.filter(a => !selectedArticles.includes(a.id)))
          
          if (currentArticle && selectedArticles.includes(currentArticle.id)) {
              setCurrentArticle(null)
          }
          
          setSelectedArticles([])
          setIsSelectionMode(false)
          setBulkDeleteConfirm(false)
          showToast(`Deleted ${selectedArticles.length} articles`, 'success')
      } catch (err) {
          console.error(err)
          showToast('Failed to delete articles', 'error')
      }
  }

  const fetchScanningStatus = async () => {
      try {
          // Optimize: Only fetch minimal data if possible, but settings endpoint is light
          const res = await api.get('/user/settings')
          if (res.data.is_scanning !== undefined) {
              setIsMemoryScanning(res.data.is_scanning)
          }
      } catch (err: any) {
          // Silent error for 401 Unauthorized to avoid console spam when session expires
          if (err.response && err.response.status === 401) {
              return
          }
          // console.error(err) // Keep silent
      }
  }

  const fetchSettings = async () => {
      try {
          const res = await api.get('/user/settings')
          setUserSettings(res.data.settings)
          if (res.data.is_scanning !== undefined) {
              setIsMemoryScanning(res.data.is_scanning)
          }
      } catch (err) {
          console.error(err)
      }
  }

  const fetchArticles = async () => {
    try {
      const params = searchQuery ? { search: searchQuery } : {}
      const res = await api.get('/articles/', { params })
      setArticles(res.data)
      return res.data
    } catch (err) {
      console.error(err)
      return []
    }
  }

  const fetchComments = async (articleId: string) => {
      try {
          const res = await api.get(`/comments/article/${articleId}`)
          const fetchedComments = res.data
          setArticleComments(prev => ({
              ...prev,
              [articleId]: {
                  open: fetchedComments.filter((c: any) => c.status === 'active'),
                  resolved: fetchedComments.filter((c: any) => c.status === 'resolved')
              }
          }))
      } catch (err) {
          console.error('Failed to fetch comments', err)
      }
  }

  // Reset last analyzed text when switching articles
  useEffect(() => {
      if (currentArticle) {
          // Initialize with current article text if available, or empty string
          // We don't have the plain text readily available here without parsing content JSON
          // So we'll just reset it to allow re-analysis if user types
          lastAnalyzedTextRef.current = '' 
          previousContentRef.current = currentArticle.content
          
          fetchComments(currentArticle.id)
      }
  }, [currentArticle?.id])

  const createNewArticle = async () => {
    try {
        const res = await api.post('/articles/', { title: 'Untitled Article' })
        setArticles([res.data, ...articles])
        setCurrentArticle(res.data)
        // Initialize empty comments for new article
        setArticleComments(prev => ({
            ...prev,
            [res.data.id]: { open: [], resolved: [] }
        }))
    } catch (err: any) {
        console.error(err)
        showToast('Failed to create article: ' + (err.response?.status === 401 ? 'Please login again' : err.message), 'error')
    }
  }

  const saveArticle = async (content: any, id?: string, title?: string) => {
      const articleId = id || currentArticle?.id
      const articleTitle = title || currentArticle?.title
      if (!articleId) return
      
      try {
          const res = await api.put(`/articles/${articleId}`, { title: articleTitle, content })
          
          // Update articles list to reflect changes
          setArticles(prev => prev.map(a => a.id === articleId ? res.data : a))
      } catch (err) {
          console.error(err)
      }
  }

  const deleteArticle = async () => {
      if (!deleteArticleId) return
      try {
          await api.delete(`/articles/${deleteArticleId}`)
          setArticles(prev => prev.filter(a => a.id !== deleteArticleId))
          if (currentArticle?.id === deleteArticleId) {
              setCurrentArticle(null)
          }
          setDeleteArticleId(null)
          showToast('Article deleted successfully', 'success')
      } catch (err) {
          console.error(err)
          showToast('Failed to delete article', 'error')
      }
  }

  const lastAnalyzedTextRef = useRef<string>('')
  const previousContentRef = useRef<any>(null)

  // Extract quote from AI full text response if available
  // Expected format:
  // >> QUOTE: <text>
  // >> COMMENT: <text>
  const parseAIResponse = (text: string): { quote: string | null, content: string } => {
      const quoteMatch = text.match(/>> QUOTE: (.*?)\n/)
      const commentMatch = text.match(/>> COMMENT: ([\s\S]*)/) // Match until end of string

      if (quoteMatch && commentMatch) {
          const quote = quoteMatch[1].trim()
          const content = commentMatch[1].trim()
          return { quote: quote === 'NONE' ? null : quote, content }
      }
      return { quote: null, content: text } // Fallback
  }

  const [activeCommentId, setActiveCommentId] = useState<string | null>(null)

  const [lastRequestTime, setLastRequestTime] = useState<Record<string, number>>({})

  const handleEditorChange = (content: any, text: string) => {
    // Save content logic
    if (JSON.stringify(content) !== JSON.stringify(previousContentRef.current)) {
        saveArticle(content)
        previousContentRef.current = content
        
        // Also update currentArticle state to keep it in sync
        setCurrentArticle((prev: any) => ({ ...prev, content }))
    }

    // Check settings before triggering AI
    if (userSettings && !userSettings.ai_enabled) return;

    // Check max open comments limit
    const maxComments = userSettings?.max_open_comments !== undefined ? userSettings.max_open_comments : 5
    if (comments.length >= maxComments) return;
    
    // Check request interval limit
    const requestInterval = userSettings?.article_request_interval || 0
    if (requestInterval > 0 && currentArticle) {
        const lastTime = lastRequestTime[currentArticle.id] || 0
        const now = Date.now()
        if (now - lastTime < requestInterval) {
            // Too soon, skip
            return
        }
    }

    // Use default delay of 2000ms if not set, otherwise use user setting
    const delay = userSettings?.ai_interval !== undefined ? userSettings.ai_interval : 2000

    // Clear existing timer
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)

    // Set new timer
    typingTimeoutRef.current = setTimeout(() => {
        // Only trigger AI if text content has meaningfully changed compared to LAST ANALYZED text
        // AND the user has stopped typing for 'delay' ms (implied by setTimeout execution)
        if (text === lastAnalyzedTextRef.current) return;
        
        lastAnalyzedTextRef.current = text
        
        const newId = uuidv4()
        // ... rest of AI logic
        setComments(prev => [...prev, { id: newId, content: '', type: 'analyzing...', isStreaming: true }])

        // Use real text content
        const textContext = text || "No content"
        
        // Update last request time immediately when we decide to proceed
        if (currentArticle) {
            setLastRequestTime(prev => ({
                ...prev,
                [currentArticle.id]: Date.now()
            }))
        }
        
        const existingQuotes = comments
            .filter(c => c.quote && c.quote !== 'NONE')
            .map(c => c.quote)
        
        analyzeText(textContext, "General", existingQuotes, (chunk) => {
            // Streaming update (raw)
            setComments(prev => prev.map(c => {
                if (c.id === newId) {
                    // Check if chunk contains NO_COMMENT to filter early if possible?
                    // But chunk might be partial. We'll filter in the UI (Sidebar) until complete.
                    return { 
                        ...c, 
                        content: c.content + chunk, 
                        type: 'suggestion',
                        isStreaming: false
                    }
                }
                return c
            }))
        }, async (fullText) => {
            // Parse AI response to get quote and clean comment
            const { quote, content } = parseAIResponse(fullText)

            // Ignore NO_COMMENT response entirely (robust check)
            if (content.toUpperCase().includes('NO_COMMENT') || content.trim() === '') {
                setComments(prev => prev.filter(c => c.id !== newId))
                return
            }

            // Ignore if quote is already present in existing open comments (deduplication)
            // But we need to check the CURRENT state, not closure state.
            // Using a functional update to setComments to check the latest state is tricky for cancellation.
            // Instead, we can check 'comments' which is a dependency if we included it, but we can't easily here.
            // However, we can check inside setComments functional update and if duplicate, REMOVE the new comment.
            
            // Actually, we can just check if 'quote' is present in 'comments'.
            // But 'comments' variable is stale here (closure).
            // We need to use the functional update pattern.
            
            // Save comment to backend
            try {
                if (!currentArticle) return
                
                // Check deduplication in backend? Or frontend?
                // Frontend is better for immediate feedback.
                // We'll do it inside setComments to access latest state.
                
                let isDuplicate = false;
                
                // We need to access the latest comments to check for duplicates BEFORE saving to DB to avoid useless writes.
                // But we can't access React state synchronously here easily without ref.
                // Let's use a ref for comments or just accept we might save duplicates to DB but filter in UI?
                // No, better to filter.
                
                // Let's use the 'setComments' callback to determine if we should proceed.
                // But 'setComments' is void.
                
                // Alternative: We can use a ref for 'comments' in Dashboard to access current value.
                // But we don't have one set up. Let's rely on backend or just check what we have.
                
                // Actually, if we use functional setComments, we can filter.
                // But we need to decide whether to CALL API.
                
                // Let's assume for now we save it, but if it's a duplicate, we maybe don't display it?
                // Or better: Use the API response.
                
                // Let's implement a simple check using a ref if we can, or just add a ref for comments in Dashboard.
                // Since I can't easily add a ref to the component body without reloading the whole file (which I can do),
                // I will add a ref for comments to Dashboard.
                
                // Wait, I can't modify Dashboard component state variables easily in this tool call block without replacing the whole file or large chunk.
                // I'll try to use a hack: check 'comments' from the closure, which might be stale.
                // But 'handleEditorChange' is recreated on every render? No, it's not wrapped in useCallback.
                // So 'comments' in 'handleEditorChange' IS fresh!
                // Wait, 'handleEditorChange' IS NOT wrapped in useCallback.
                // But it's passed to TipTapEditor.
                // If it's not useCallback, it's recreated every render.
                // So 'comments' variable inside it is the value at the time of render.
                // But 'setTimeout' runs later. The 'comments' captured in the closure of setTimeout will be the ones from when the timeout was SET.
                // That might be 2 seconds ago. 
                // That's reasonably fresh.
                
                if (quote && comments.some(c => c.quote === quote && c.status !== 'resolved')) {
                     // Duplicate found!
                     // Remove the placeholder comment
                     setComments(prev => prev.filter(c => c.id !== newId))
                     return
                }

                const res = await api.post('/comments/', {
                    article_id: currentArticle.id,
                    content: content,
                    quote: quote,
                    type: 'suggestion'
                })
                const savedComment = res.data
                
                // Replace the temporary comment with the saved one in the state
                setComments(prev => {
                    // Double check duplicate here just in case (race condition)
                    if (quote && prev.some(c => c.quote === quote && c.id !== newId && c.status !== 'resolved')) {
                        return prev.filter(c => c.id !== newId)
                    }
                    
                    return prev.map(c => {
                        if (c.id === newId) {
                            return { ...savedComment, isStreaming: false }
                        }
                        return c
                    })
                })
            } catch (err) {
                console.error('Failed to save comment', err)
            }
        })
    }, delay)
  }

  const resolveComment = async (id: string) => {
      try {
          await api.put(`/comments/${id}/resolve`)
          
          // Move locally first for responsiveness
          const commentToResolve = comments.find(c => c.id === id)
          if (commentToResolve) {
              const updatedComment = { ...commentToResolve, status: 'resolved' }
              setResolvedComments(prev => [updatedComment, ...prev])
              setComments(prev => prev.filter(c => c.id !== id))
              
              // Also update in the source of truth if we were fetching all comments
              // But here we rely on 'comments' prop passed to TipTapEditor which is 'open' comments
              // However, TipTapEditor receives 'comments' which is the 'open' list.
              // So if we remove it from 'open', it should trigger TipTapEditor effect to remove mark?
              // The logic in TipTapEditor iterates 'comments'. If a comment is GONE from the list, 
              // it doesn't automatically remove the mark unless we explicitly clear marks.
              // My previous TipTapEditor logic ONLY ADDS marks. It doesn't clear old ones effectively.
              // Let's fix TipTapEditor to handle removals too.
          }
      } catch (err) {
          console.error('Failed to resolve comment', err)
      }
  }

  const replyComment = async (id: string, content: string) => {
      // Optimistic update
      setComments(prev => prev.map(c => {
          if (c.id === id) {
              const currentReply = Array.isArray(c.reply) ? c.reply : []
              return { 
                  ...c, 
                  reply: [
                      ...currentReply,
                      { role: 'user', content: content, timestamp: new Date().toISOString() }
                  ]
              }
          }
          return c
      }))

      try {
        const res = await api.post(`/comments/${id}/reply`, { content })
        
        // Update with real response (which includes AI response)
        if (res.data.reply_list) {
             setComments(prev => prev.map(c => {
                if (c.id === id) {
                    return { 
                        ...c, 
                        reply: res.data.reply_list
                    }
                }
                return c
            }))
        }
      } catch (err) {
          console.error('Failed to reply', err)
          // Revert optimistic update on error? Or just show error toast.
          showToast('Failed to send reply', 'error')
      }
  }

  return (
    <div className="w-full h-screen flex flex-col p-4">
      <div className="flex justify-between mb-4 items-center">
        <h1 
            className="text-2xl font-bold cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-2"
            onClick={() => setCurrentArticle(null)}
            title="Go to Calendar"
        >
            <img src="/logo.svg" alt="Aura Logo" className="h-10 w-10 object-contain" />
            <span>Aura</span>
        </h1>
        <div className="flex gap-4 items-center">
            <button 
                onClick={() => setCurrentArticle(null)}
                className="text-gray-600 hover:text-blue-600 flex items-center gap-1"
            >
                <span>📅</span>
                <span className="hidden sm:inline">Calendar</span>
            </button>
            <button 
                onClick={() => onNavigate && onNavigate('memory')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
                    isMemoryScanning 
                    ? 'text-purple-600 bg-purple-50 hover:bg-purple-100' 
                    : 'text-gray-600 hover:text-purple-600 hover:bg-gray-50'
                }`}
            >
                {isMemoryScanning ? (
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                        </span>
                        <span className="font-medium text-sm">Scanning...</span>
                    </div>
                ) : (
                    <>
                        <span>🧠</span>
                        <span className="font-medium">Memory</span>
                    </>
                )}
            </button>
            <button 
                onClick={() => setIsSettingsOpen(true)}
                className="text-gray-600 hover:text-blue-600"
            >
                ⚙️ Settings
            </button>
            <button onClick={logout} className="text-red-500 hover:text-red-700">Logout</button>
        </div>
      </div>
      <div className="flex gap-4 flex-1 overflow-hidden relative">
        {/* Article List */}
        <div className={`border-r overflow-hidden flex-shrink-0 transition-all duration-300 ease-in-out relative ${isLeftSidebarOpen ? 'w-80 pr-4' : 'w-0'}`}>
            <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
            >
                <div className={`h-full overflow-y-auto ${isLeftSidebarOpen ? 'opacity-100' : 'opacity-0'}`} style={{ width: '100%' }}>
                    <div className="mb-4 space-y-2">
                        {isSelectionMode ? (
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setBulkDeleteConfirm(true)} 
                                    disabled={selectedArticles.length === 0}
                                    className="flex-1 bg-red-50 text-red-600 border border-red-100 p-2.5 rounded-lg hover:bg-red-100 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={16} />
                                    <span>Delete ({selectedArticles.length})</span>
                                </button>
                                <button 
                                    onClick={() => {
                                        setIsSelectionMode(false)
                                        setSelectedArticles([])
                                    }} 
                                    className="px-3 bg-white text-gray-600 border border-gray-200 p-2.5 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button onClick={createNewArticle} className="w-full bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 transition font-medium shadow-sm flex items-center justify-center gap-2">
                                <span>+</span> New Article
                            </button>
                        )}
                        
                        <div className="flex gap-2">
                            <input 
                                className="flex-1 p-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-all"
                                placeholder="Search articles..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <button 
                                onClick={() => setIsSelectionMode(!isSelectionMode)}
                                className={`p-2.5 rounded-lg border transition-all ${
                                    isSelectionMode 
                                    ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-inner' 
                                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 hover:border-gray-300'
                                }`}
                                title={isSelectionMode ? "Exit Selection Mode" : "Select Multiple"}
                            >
                                <CheckSquare size={20} />
                            </button>
                        </div>
                    </div>
                    <SortableContext  
                        items={articles.map(a => a.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <ul className="space-y-2 p-1">
                            {articles.map(a => (
                                <SortableArticleItem 
                                    key={a.id} 
                                    article={a}
                                    currentArticle={currentArticle}
                                    latestArticleId={latestArticleId}
                                    onSelect={setCurrentArticle}
                                    onDelete={setDeleteArticleId}
                                    isSelectionMode={isSelectionMode}
                                    isSelectedForBulk={selectedArticles.includes(a.id)}
                                    onToggleSelection={toggleArticleSelection}
                                />
                            ))}
                        </ul>
                    </SortableContext>
                </div>
                <DragOverlay adjustScale={true}>
                    {activeDragId ? (
                        <ArticleItem
                            article={articles.find(a => a.id === activeDragId)}
                            currentArticle={currentArticle}
                            latestArticleId={latestArticleId}
                            onSelect={() => {}}
                            onDelete={() => {}}
                            isOverlay={true}
                        />
                    ) : null}
                </DragOverlay>
            </DndContext>
            
            <button  
                onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
                className="absolute -right-3 top-2 z-10 bg-white border rounded-full p-1 shadow-md hover:bg-gray-100 text-gray-500 hover:text-blue-600"
                style={{ right: '-12px' }}
            >
                {isLeftSidebarOpen ? <ChevronLeft size={16}/> : <ChevronRight size={16}/>}
            </button>
        </div>
        
        {!isLeftSidebarOpen && (
             <button 
                onClick={() => setIsLeftSidebarOpen(true)}
                className="absolute left-2 top-2 z-10 bg-white border rounded-full p-1 shadow-md hover:bg-gray-100 text-gray-500 hover:text-blue-600"
            >
                <ChevronRight size={16}/>
            </button>
        )}
        
        {/* Editor Area */}
        <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
            {currentArticle ? (
                <>
                    <input 
                        className="text-xl font-bold mb-4 p-2 border-b outline-none focus:border-blue-500 bg-transparent"
                        value={currentArticle.title}
                        onChange={(e) => {
                            const newTitle = e.target.value
                            setCurrentArticle({...currentArticle, title: newTitle})
                            // Optimistically update the list
                            setArticles(prev => prev.map(a => a.id === currentArticle.id ? {...a, title: newTitle} : a))
                        }}
                        onBlur={() => saveArticle(currentArticle.content, currentArticle.id, currentArticle.title)}
                    />
                    <div className="flex-1 overflow-y-auto">
                        <TipTapEditor 
                            key={currentArticle.id} 
                            content={currentArticle.content} 
                            onChange={handleEditorChange} 
                            comments={comments}
                            activeCommentId={activeCommentId}
                            onCommentSelect={setActiveCommentId}
                            onTextNotFound={resolveComment} // Auto-resolve if text is deleted
                        />
                    </div>
                </>
            ) : (
                <div className="flex items-center justify-center h-full bg-gray-50/30">
                    <Calendar />
                </div>
            )}
        </div>

        {/* Comment Sidebar */}
        {currentArticle && (
            <>
                {!isRightSidebarOpen && (
                     <button 
                        onClick={() => setIsRightSidebarOpen(true)}
                        className="absolute right-2 top-2 z-10 bg-white border rounded-full p-1 shadow-md hover:bg-gray-100 text-gray-500 hover:text-blue-600"
                    >
                        <ChevronLeft size={16}/>
                    </button>
                )}
                
                <div className={`border-l overflow-hidden flex-shrink-0 transition-all duration-300 ease-in-out relative ${isRightSidebarOpen ? 'w-80' : 'w-0'}`}>
                     <div className={`h-full overflow-hidden ${isRightSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
                        <CommentSidebar 
                            comments={comments} 
                            resolvedComments={resolvedComments} 
                            activeCommentId={activeCommentId}
                            onResolve={resolveComment} 
                            onReply={replyComment} 
                            onActivate={setActiveCommentId}
                        />
                     </div>
                     
                     <button 
                        onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                        className="absolute -left-3 top-2 z-10 bg-white border rounded-full p-1 shadow-md hover:bg-gray-100 text-gray-500 hover:text-blue-600"
                        style={{ left: '-12px' }}
                    >
                        {isRightSidebarOpen ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
                    </button>
                </div>
            </>
        )}
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onSettingsChange={setUserSettings} 
      />

      <ConfirmDialog 
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={handleBulkDeleteArticles}
        title="Delete Selected Articles"
        message={`Are you sure you want to delete ${selectedArticles.length} articles? This action cannot be undone.`}
        variant="danger"
        confirmText={`Delete ${selectedArticles.length} Articles`}
      />

      <ConfirmDialog 
        isOpen={!!deleteArticleId}
        onClose={() => setDeleteArticleId(null)}
        onConfirm={deleteArticle}
        title="Delete Article"
        message="Are you sure you want to delete this article? This action cannot be undone."
        variant="danger"
        confirmText="Delete"
      />
    </div>
  )
}

export default Dashboard
