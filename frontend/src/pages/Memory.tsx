import { useState, useEffect } from 'react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import ConfirmDialog from '../components/UI/ConfirmDialog'
import Modal from '../components/UI/Modal'
import { HelpCircle, Edit2 } from 'lucide-react'

interface Memory {
  id: string;
  key: string;
  value: { content: string; emoji: string };
  category: string;
  is_locked: boolean;
  confidence: string;
  updated_at?: string;
  updated_by?: string;
}

interface MemoryPageProps {
    onNavigate?: (page: string) => void;
}

const MemoryPage = ({ onNavigate }: MemoryPageProps) => {
  const [memories, setMemories] = useState<Memory[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null)
  const [selectedMemories, setSelectedMemories] = useState<string[]>([])
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newMemory, setNewMemory] = useState({
      content: '',
      category: 'Knowledge',
      confidence: 'low',
      emoji: '📝'
  })

  const EMOJI_OPTIONS = ['📝', '🧠', '💡', '📅', '❤️', '⭐', '🔥', '✅', '❌', '⚠️', '🔗', '📂', '👤', '🏢', '⚙️', '🎨']

  useEffect(() => {
    fetchMemories()
  }, [])

  const fetchMemories = async () => {
    try {
      const res = await api.get('/memories/')
      setMemories(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const toggleLock = async (id: string, currentLock: boolean) => {
    try {
        const res = await api.put(`/memories/${id}`, { is_locked: !currentLock })
        setMemories(memories.map(m => m.id === id ? { ...m, is_locked: res.data.is_locked } : m))
    } catch (err) {
        console.error(err)
    }
  }

  const confirmDelete = async () => {
      if (!deleteId) return
      try {
          await api.delete(`/memories/${deleteId}`)
          setMemories(memories.filter(m => m.id !== deleteId))
          setDeleteId(null)
      } catch (err) {
          console.error(err)
      }
  }

  const handleDeleteClick = (id: string) => {
      setDeleteId(id)
  }

  const handleSaveEdit = async () => {
      if (!editingMemory) return
      try {
          const res = await api.put(`/memories/${editingMemory.id}`, { 
              content: editingMemory.value.content,
              confidence: editingMemory.confidence,
              category: editingMemory.category,
              emoji: editingMemory.value.emoji
          })
          setMemories(memories.map(m => m.id === editingMemory.id ? { 
              ...m, 
              value: { 
                  ...m.value, 
                  content: res.data.value.content,
                  emoji: res.data.value.emoji 
              },
              confidence: res.data.confidence,
              category: res.data.category,
              updated_at: res.data.updated_at,
              updated_by: 'user' 
          } : m))
          setEditingMemory(null)
      } catch (err) {
          console.error(err)
      }
  }

  const toggleSelection = (id: string) => {
      if (selectedMemories.includes(id)) {
          setSelectedMemories(selectedMemories.filter(mid => mid !== id))
      } else {
          setSelectedMemories([...selectedMemories, id])
      }
  }

  const handleBulkDelete = async () => {
      try {
          await Promise.all(selectedMemories.map(id => api.delete(`/memories/${id}`)))
          setMemories(memories.filter(m => !selectedMemories.includes(m.id)))
          setSelectedMemories([])
          setIsSelectionMode(false)
          setBulkDeleteConfirm(false)
      } catch (err) {
          console.error(err)
      }
  }

  const handleAddMemory = async () => {
      if (!newMemory.content.trim()) return
      try {
          const res = await api.post('/memories/', newMemory)
          setMemories([res.data, ...memories])
          setIsAddModalOpen(false)
          setNewMemory({
              content: '',
              category: 'Knowledge',
              confidence: 'low',
              emoji: '📝'
          })
      } catch (err) {
          console.error(err)
      }
  }

  const uniqueCategories = Array.from(new Set([...memories.map(m => m.category || 'Knowledge'), 'Preferences', 'Knowledge', 'Concept', 'Event']))
    .filter(Boolean)
    .sort()
    
  const categories = ['All', ...uniqueCategories]

  const filteredMemories = activeCategory === 'All'
    ? memories
    : memories.filter(m => (m.category || 'Knowledge') === activeCategory)

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <div className="w-full">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                Memory Bank
            </h1>
            <p className="text-gray-500 mt-1">Your personal knowledge base, curated by AI.</p>
          </div>
          <div className="flex gap-3">
            <button 
                onClick={() => setIsAddModalOpen(true)}
                className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-full shadow-md hover:bg-blue-700 hover:shadow-lg transition-all flex items-center gap-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add Memory
            </button>
            {isSelectionMode ? (
                <>
                    <span className="flex items-center text-sm text-gray-500 mr-2">
                        {selectedMemories.length} selected
                    </span>
                    <button 
                        onClick={() => setBulkDeleteConfirm(true)}
                        disabled={selectedMemories.length === 0}
                        className="px-5 py-2.5 bg-red-50 text-red-600 font-medium rounded-full shadow-sm hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Delete Selected
                    </button>
                    <button 
                        onClick={() => {
                            setIsSelectionMode(false)
                            setSelectedMemories([])
                        }}
                        className="px-5 py-2.5 bg-white text-gray-700 font-medium rounded-full shadow-sm hover:shadow-md transition-all border border-gray-100"
                    >
                        Cancel
                    </button>
                </>
            ) : (
                <button 
                    onClick={() => setIsSelectionMode(true)}
                    className="px-5 py-2.5 bg-white text-gray-700 font-medium rounded-full shadow-sm hover:shadow-md transition-all border border-gray-100 flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Select
                </button>
            )}
            <button 
                onClick={() => onNavigate ? onNavigate('dashboard') : window.location.href = '/'} 
                className="px-5 py-2.5 bg-white text-gray-700 font-medium rounded-full shadow-sm hover:shadow-md transition-all border border-gray-100"
            >
                ← Back to Editor
            </button>
          </div>
        </header>

        <div className="flex flex-wrap gap-3 mb-8">
            {categories.map(cat => (
                <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                        activeCategory === cat 
                        ? 'bg-gray-900 text-white shadow-lg scale-105' 
                        : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 shadow-sm'
                    }`}
                >
                    {cat}
                </button>
            ))}
        </div>

        {loading ? (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        ) : filteredMemories.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-gray-100">
                <div className="text-6xl mb-4 opacity-50">✨</div>
                <h3 className="text-xl font-medium text-gray-900">No memories found</h3>
                <p className="text-gray-500 mt-2">Start writing to let the AI learn about you.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMemories.map(m => (
                    <div 
                        key={m.id} 
                        className={`group relative p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                            m.is_locked 
                            ? 'bg-gray-50 border border-gray-200' 
                            : 'bg-white border border-gray-100 shadow-sm'
                        } ${isSelectionMode && selectedMemories.includes(m.id) ? 'ring-2 ring-blue-500 bg-blue-50/30' : ''}`}
                        onClick={() => isSelectionMode && toggleSelection(m.id)}
                    >
                        {isSelectionMode && (
                            <div className="absolute top-4 right-4 z-10">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                    selectedMemories.includes(m.id)
                                    ? 'bg-blue-500 border-blue-500'
                                    : 'border-gray-300 bg-white group-hover:border-blue-400'
                                }`}>
                                    {selectedMemories.includes(m.id) && (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-4xl filter drop-shadow-sm">{m.value?.emoji || '📝'}</span>
                            <div className={`flex gap-2 ${isSelectionMode ? 'opacity-0 pointer-events-none' : ''}`}>
                                <span className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-bold flex items-center ${
                                    m.category === 'Preferences' ? 'bg-purple-100 text-purple-700' :
                                    m.category === 'Event' ? 'bg-orange-100 text-orange-700' :
                                    m.category === 'Concept' ? 'bg-blue-100 text-blue-700' :
                                    'bg-green-100 text-green-700'
                                }`}>
                                    <span className="translate-y-[1px]">{m.category || 'Knowledge'}</span>
                                </span>
                                <button 
                                    onClick={() => toggleLock(m.id, m.is_locked)}
                                    className={`p-1.5 rounded-full transition-colors ${
                                        m.is_locked 
                                        ? 'text-red-500 bg-red-50 hover:bg-red-100' 
                                        : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
                                    }`}
                                    title={m.is_locked ? "Locked" : "Unlock"}
                                >
                                    {m.is_locked ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                    )}
                                </button>
                                <button 
                                    onClick={() => handleDeleteClick(m.id)}
                                    className="p-1.5 rounded-full text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    title="Delete Memory"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        
                        <h3 
                            className="text-gray-900 font-semibold text-lg leading-snug mb-2 cursor-pointer hover:text-blue-600 transition-colors"
                            onDoubleClick={() => setEditingMemory(m)}
                            title="Double click to edit"
                        >
                            {m.value?.content || 'No content'}
                        </h3>
                        
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                            <div className="flex flex-col gap-1 min-w-0 flex-1 mr-4">
                                <code className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded w-fit max-w-full truncate">
                                    {m.key}
                                </code>
                                {m.updated_at && (
                                    <span className="text-[10px] text-gray-400 pl-1 flex items-center gap-1">
                                        <span>
                                            Updated: {new Date(m.updated_at + (m.updated_at.endsWith('Z') ? '' : 'Z')).toLocaleString(undefined, {
                                                year: 'numeric',
                                                month: 'numeric',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                        {m.updated_by && (
                                            <span className={`px-1 rounded text-[9px] border ${
                                                m.updated_by === 'user' 
                                                ? 'bg-blue-50 text-blue-500 border-blue-100' 
                                                : 'bg-gray-100 text-gray-500 border-gray-200'
                                            }`}>
                                                {m.updated_by === 'user' ? 'Manual' : 'Auto'}
                                            </span>
                                        )}
                                    </span>
                                )}
                            </div>
                            
                            <div className="flex items-center flex-shrink-0 gap-1.5 relative">
                                {m.confidence === 'high' && (
                                    <span className="flex items-center text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100 whitespace-nowrap">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                                        High
                                    </span>
                                )}
                                {m.confidence === 'medium' && (
                                    <span className="flex items-center text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100 whitespace-nowrap">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
                                        Medium
                                    </span>
                                )}
                                {m.confidence === 'low' && (
                                    <span className="flex items-center text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full border border-gray-200 whitespace-nowrap">
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-1.5"></span>
                                        Low
                                    </span>
                                )}
                                
                                <div className="group/help relative">
                                    <HelpCircle size={14} className="text-gray-300 hover:text-gray-500 cursor-help transition-colors" />
                                    <div className="absolute bottom-full right-0 mb-2 w-56 p-3 bg-gray-900/95 backdrop-blur-sm text-white text-[10px] rounded-lg shadow-xl opacity-0 invisible group-hover/help:opacity-100 group-hover/help:visible transition-all duration-200 pointer-events-none z-50 transform translate-y-1 group-hover/help:translate-y-0 border border-white/10">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
                                                <span className="font-bold text-emerald-400">High:</span>
                                                <span className="text-gray-300">Explicitly stated or verified facts.</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>
                                                <span className="font-bold text-amber-400">Medium:</span>
                                                <span className="text-gray-300">Inferred from context or patterns.</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0"></span>
                                                <span className="font-bold text-gray-400">Low:</span>
                                                <span className="text-gray-300">Uncertain or ambiguous info.</span>
                                            </div>
                                        </div>
                                        <div className="absolute -bottom-1 right-1 w-2 h-2 bg-gray-900/95 transform rotate-45 border-r border-b border-white/10"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      <ConfirmDialog 
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Memories"
        message={`Are you sure you want to delete ${selectedMemories.length} memories? This action cannot be undone.`}
        variant="danger"
        confirmText={`Delete ${selectedMemories.length} Memories`}
      />

      <ConfirmDialog 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Delete Memory"
        message="Are you sure you want to delete this memory? This action cannot be undone."
        variant="danger"
        confirmText="Delete"
      />

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Memory"
        footer={
            <>
                <button 
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleAddMemory}
                    disabled={!newMemory.content.trim()}
                    className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg shadow-blue-200 hover:bg-blue-700 shadow-sm transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Add Memory
                </button>
            </>
        }
      >
          <div className="space-y-4">
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                  <textarea 
                      className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 min-h-[100px]"
                      placeholder="e.g., User prefers dark mode..."
                      value={newMemory.content}
                      onChange={e => setNewMemory({ ...newMemory, content: e.target.value })}
                  />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                      <select 
                          className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-blue-500 bg-white"
                          value={newMemory.category}
                          onChange={e => setNewMemory({ ...newMemory, category: e.target.value })}
                      >
                          {['Knowledge', 'Preferences', 'Concept', 'Event', 'Other'].map(c => (
                              <option key={c} value={c}>{c}</option>
                          ))}
                      </select>
                  </div>
                  
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Confidence</label>
                      <select 
                          className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-blue-500 bg-white"
                          value={newMemory.confidence}
                          onChange={e => setNewMemory({ ...newMemory, confidence: e.target.value })}
                      >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                      </select>
                  </div>
              </div>

              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
                  <div className="grid grid-cols-8 gap-2">
                      {EMOJI_OPTIONS.map(emoji => (
                          <button
                              key={emoji}
                              onClick={() => setNewMemory({ ...newMemory, emoji })}
                              className={`aspect-square flex items-center justify-center text-xl rounded-lg transition-all ${
                                  newMemory.emoji === emoji 
                                  ? 'bg-blue-100 border-2 border-blue-500 scale-110 shadow-sm' 
                                  : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
                              }`}
                          >
                              {emoji}
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      </Modal>

      <Modal
        isOpen={!!editingMemory}
        onClose={() => setEditingMemory(null)}
        title="Edit Memory"
        footer={
            <>
                <button 
                    onClick={() => setEditingMemory(null)}
                    className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleSaveEdit}
                    className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg shadow-blue-200 hover:bg-blue-700 shadow-sm transition-all transform active:scale-95"
                >
                    Save Changes
                </button>
            </>
        }
      >
          {editingMemory && (
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                    <textarea 
                        className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 min-h-[100px]"
                        value={editingMemory.value.content}
                        onChange={e => setEditingMemory({
                            ...editingMemory,
                            value: { ...editingMemory.value, content: e.target.value }
                        })}
                    />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                        <select 
                            className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-blue-500 bg-white"
                            value={editingMemory.category || 'Knowledge'}
                            onChange={e => setEditingMemory({ ...editingMemory, category: e.target.value })}
                        >
                            {['Knowledge', 'Preferences', 'Concept', 'Event', 'Other'].map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Confidence Level</label>
                        <select 
                            className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-blue-500 bg-white"
                            value={editingMemory.confidence}
                            onChange={e => setEditingMemory({ ...editingMemory, confidence: e.target.value })}
                        >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
                    <div className="grid grid-cols-8 gap-2">
                        {EMOJI_OPTIONS.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => setEditingMemory({
                                    ...editingMemory,
                                    value: { ...editingMemory.value, emoji: emoji }
                                })}
                                className={`aspect-square flex items-center justify-center text-xl rounded-lg transition-all ${
                                    (editingMemory.value.emoji || '📝') === emoji 
                                    ? 'bg-blue-100 border-2 border-blue-500 scale-110 shadow-sm' 
                                    : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
                                }`}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
          )}
      </Modal>
    </div>
  )
}

export default MemoryPage