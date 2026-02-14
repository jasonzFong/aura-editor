import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import ListItem from '@tiptap/extension-list-item'
import { Underline } from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { TextAlign } from '@tiptap/extension-text-align'
import { Placeholder } from '@tiptap/extension-placeholder'
import { useEffect, useRef } from 'react'
import EditorToolbar from './EditorToolbar'

import { CommentMark } from './extensions/CommentMark'

interface TipTapEditorProps {
  content?: any;
  onChange?: (content: any, text: string) => void;
  editable?: boolean;
  comments?: any[];
  activeCommentId?: string | null;
  onCommentSelect?: (id: string | null) => void;
  onTextNotFound?: (commentId: string) => void;
}

const TipTapEditor = ({ content, onChange, editable = true, comments = [], activeCommentId, onCommentSelect, onTextNotFound }: TipTapEditorProps) => {
  const onChangeRef = useRef(onChange)
  useEffect(() => {
      onChangeRef.current = onChange
  }, [onChange])

  const commentsRef = useRef(comments)
  const onTextNotFoundRef = useRef(onTextNotFound)

  useEffect(() => {
      commentsRef.current = comments
  }, [comments])

  useEffect(() => {
      onTextNotFoundRef.current = onTextNotFound
  }, [onTextNotFound])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        listItem: false,
      }),
      ListItem.extend({
        content: 'block+',
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({
        nested: false, // Changed from true to false to simplify DOM
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Start writing your amazing article...',
      }),
      CommentMark,
    ],
    content: content,
    editable: editable,
    onUpdate: ({ editor }) => {
      onChangeRef.current && onChangeRef.current(editor.getJSON(), editor.getText())
      
      // Check for orphaned comments
      const activeComments = commentsRef.current || []
      if (activeComments.length === 0) return

      // Collect all existing comment marks in the doc
      const existingCommentIds = new Set()
      editor.state.doc.descendants((node) => {
          node.marks.forEach(mark => {
              if (mark.type.name === 'comment') {
                  existingCommentIds.add(mark.attrs.commentId)
              }
          })
          return true
      })

      // If an active comment is missing its mark, it means the text was deleted
      activeComments.forEach(comment => {
          if (!comment.quote || comment.quote === 'NONE') return
          
          if (!existingCommentIds.has(comment.id)) {
               // Mark is gone!
               if (onTextNotFoundRef.current) {
                   onTextNotFoundRef.current(comment.id)
               }
          }
      })
    },
    editorProps: {
        attributes: {
            class: 'outline-none h-full',
        },
        handleClickOn: (view, pos, node, nodePos, event, direct) => {
            const attrs = (event.target as HTMLElement).getAttribute('data-comment-id')
            if (attrs && onCommentSelect) {
                onCommentSelect(attrs)
                return true
            }
            return false
        }
    },
  })

  const prevCommentsRef = useRef<any[]>([])
  
  // Update comments marks
  useEffect(() => {
      if (!editor) return

      const currentComments = comments || []
      const prevComments = prevCommentsRef.current
      const tr = editor.state.tr
      let modified = false

      // 1. Handle New Comments: Add marks
      currentComments.forEach(comment => {
          if (!comment || !comment.quote || comment.quote === 'NONE' || comment.content.trim() === '>> NO_COMMENT' || comment.content.trim() === 'NO_COMMENT') return
          
          // Check if this quote is already covered by an existing mark from ANOTHER comment
          // If so, we should SKIP adding this new comment to the UI/State or just not mark it?
          // User requirement: "If found AI new quote is already cited in open comments, ignore it"
          // This logic should ideally be in Dashboard before adding to 'comments' state.
          // But if we do it here, we just don't add the mark.
          // However, the comment card would still show up in sidebar.
          // So we should filter in Dashboard. But let's check here for marks logic.
          
          const wasPresent = prevComments.find(c => c.id === comment.id)
          if (!wasPresent) {
             // ... existing logic
             let markExists = false
             editor.state.doc.descendants((node) => {
                 if (node.marks.find(m => m.type.name === 'comment' && m.attrs.commentId === comment.id)) {
                     markExists = true
                     return false // Stop descending
                 }
                 return true
             })

             if (!markExists) {
                 // Try to add it by text search
                 try {
                  const fullText = editor.getText()
                  const index = fullText.indexOf(comment.quote)
                  
                  if (index !== -1) {
                      editor.state.doc.descendants((node, pos) => {
                          if (node.isText && node.text) {
                              const textIndex = node.text.indexOf(comment.quote!)
                              if (textIndex !== -1) {
                                  const from = pos + textIndex
                                  const to = from + comment.quote!.length
                                  tr.addMark(from, to, editor.schema.marks.comment.create({ commentId: comment.id }))
                                  modified = true
                              }
                          }
                          return true
                      })
                  }
              } catch (e) {
                  console.error(e)
              }
             }
          }
      })

      // 2. Handle Resolved/Removed Comments: Remove marks
      prevComments.forEach(prevComment => {
          if (!prevComment) return // Add null check for prevComment
          const isPresent = currentComments.find(c => c && c.id === prevComment.id)
          if (!isPresent) {
              // Find mark by ID and remove it
              editor.state.doc.descendants((node, pos) => {
                  const mark = node.marks.find(m => m.type.name === 'comment' && m.attrs.commentId === prevComment.id)
                  if (mark) {
                      tr.removeMark(pos, pos + node.nodeSize, mark)
                      modified = true
                  }
                  return true
              })
          }
      })

      if (modified) {
          editor.view.dispatch(tr)
      }
      
      prevCommentsRef.current = currentComments
  }, [comments, editor])

  // Basic content sync
  useEffect(() => {
    if (editor && content) {
        // Only update if content is different to avoid cursor jumps and loops
        const currentContent = editor.getJSON()
        if (JSON.stringify(currentContent) !== JSON.stringify(content)) {
             editor.commands.setContent(content)
        }
    }
  }, [content, editor])

  return (
    <div className="border border-gray-300 rounded-lg bg-white shadow-sm flex flex-col h-full overflow-hidden">
      {editable && <EditorToolbar editor={editor} />}
      <div 
        className="flex-1 p-4 prose max-w-none cursor-text overflow-y-auto"
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent editor={editor} className="h-full min-h-[500px]" />
      </div>
      <style>{`
        .ProseMirror {
          min-height: 500px;
          outline: none;
          padding-bottom: 100px;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        
        /* Lists */
        .ProseMirror ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .ProseMirror ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .ProseMirror li {
            margin: 0.2em 0;
        }
        .ProseMirror li::marker {
            color: #2563eb;
        }
        
        /* Adjust list item styles when they contain headings to match marker size */
        .ProseMirror li:has(> h1) {
            font-size: 1.8rem;
            font-weight: 700;
            line-height: 1.2;
            margin-top: 1.5rem;
            margin-bottom: 0.5rem;
        }
        .ProseMirror li:has(> h2) {
            font-size: 1.4rem;
            font-weight: 600;
            line-height: 1.3;
            margin-top: 1.2rem;
            margin-bottom: 0.5rem;
        }
        .ProseMirror li:has(> h3) {
            font-size: 1.2rem;
            font-weight: 600;
            line-height: 1.3;
            margin-top: 1rem;
            margin-bottom: 0.5rem;
        }
        
        /* Reset margins for headings inside lists to avoid double spacing */
        .ProseMirror li > h1,
        .ProseMirror li > h2,
        .ProseMirror li > h3 {
            margin: 0;
        }

        .ProseMirror li p {
            margin: 0;
        }

        /* Task List styles removed as feature is disabled */
        /*
        ul[data-type="taskList"] { ... }
        li[data-type="taskItem"] { ... }
        */

        /* Blockquote */
        .ProseMirror blockquote {
            border-left: 3px solid #e5e7eb;
            padding-left: 1rem;
            margin-left: 0;
            margin-right: 0;
            color: #4b5563;
            font-style: italic;
        }

        /* Code Block */
        .ProseMirror pre {
            background: #f3f4f6;
            border-radius: 0.5rem;
            color: #1f2937;
            font-family: 'JetBrains Mono', monospace;
            padding: 0.75rem 1rem;
        }
        .ProseMirror code {
            font-size: 0.9em;
            padding: 0.25em;
            border-radius: 0.25rem;
            background-color: #f3f4f6;
            color: #616161;
            box-decoration-break: clone;
        }

        /* Headings */
        .ProseMirror h1 {
            font-size: 1.8rem;
            font-weight: 700;
            line-height: 1.2;
            margin-top: 1.5rem;
            margin-bottom: 0.5rem;
        }
        .ProseMirror h2 {
            font-size: 1.4rem;
            font-weight: 600;
            line-height: 1.3;
            margin-top: 1.2rem;
            margin-bottom: 0.5rem;
        }
        .ProseMirror h3 {
            font-size: 1.2rem;
            font-weight: 600;
            line-height: 1.3;
            margin-top: 1rem;
            margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  )
}

export default TipTapEditor
