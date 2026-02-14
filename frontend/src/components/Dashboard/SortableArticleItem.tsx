import React, { forwardRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, GripVertical } from 'lucide-react';

interface ArticleItemProps {
    article: any;
    currentArticle: any;
    latestArticleId: string | null;
    onSelect: (article: any) => void;
    onDelete: (id: string) => void;
    dragAttributes?: any;
    dragListeners?: any;
    isDragging?: boolean;
    isOverlay?: boolean;
    style?: React.CSSProperties;
    isSelectionMode?: boolean;
    isSelectedForBulk?: boolean;
    onToggleSelection?: (id: string) => void;
}

export const ArticleItem = forwardRef<HTMLLIElement, ArticleItemProps>(
    ({ article, currentArticle, latestArticleId, onSelect, onDelete, dragAttributes, dragListeners, isDragging, isOverlay, style, isSelectionMode, isSelectedForBulk, onToggleSelection }, ref) => {
        const a = article;
        
        const isCurrent = currentArticle?.id === a.id;
        
        let containerClasses = `group relative cursor-pointer p-3 rounded-xl transition-all duration-200 border list-none `;
        
        if (isOverlay) {
            containerClasses += `shadow-xl z-50 cursor-grabbing scale-[1.02] `;
            if (isCurrent) {
                containerClasses += `bg-white border-blue-500 `;
            } else {
                containerClasses += `bg-white border-transparent `; // Match normal state more closely
            }
        } else {
            if (isSelectionMode && isSelectedForBulk) {
                containerClasses += `bg-blue-50 border-blue-500 shadow-sm `;
            } else if (isCurrent) {
                containerClasses += `bg-white border-blue-500 shadow-md transform scale-[1.02] `;
            } else {
                containerClasses += `bg-white border-transparent hover:bg-gray-50 hover:border-gray-200 `;
            }
        }
        
        if (isDragging) {
            containerClasses += `opacity-30 `;
        } else {
            containerClasses += `opacity-100 `;
        }

        const handleClick = (e: React.MouseEvent) => {
            if (isSelectionMode && onToggleSelection) {
                e.preventDefault();
                onToggleSelection(a.id);
            } else {
                onSelect(a);
            }
        };

        return (
            <li 
                ref={ref}
                style={style}
                className={containerClasses}
                onClick={handleClick}
            >
                <div className="flex justify-between items-start mb-1.5">
                    <div className={`font-semibold pr-6 flex items-center gap-2 min-w-0 ${isCurrent ? 'text-blue-700' : 'text-gray-800'}`}>
                        {/* Selection Checkbox or Drag Handle */}
                        <div className="flex-shrink-0 w-5 mr-1 flex items-center justify-center">
                            {isSelectionMode ? (
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelectedForBulk ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
                                    {isSelectedForBulk && <div className="w-2 h-2 bg-white rounded-sm" />}
                                </div>
                            ) : (
                                <div {...dragAttributes} {...dragListeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 touch-none">
                                    <GripVertical size={14} />
                                </div>
                            )}
                        </div>
                        
                        <span className="truncate">{a.title}</span>
                        {latestArticleId === a.id && (
                            <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                Latest
                            </span>
                        )}
                    </div>
                    {!isOverlay && !isSelectionMode && (
                        <button 
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all rounded hover:bg-red-50 absolute top-2 right-2"
                            onClick={(e) => {
                                e.stopPropagation()
                                onDelete(a.id)
                            }}
                            title="Delete article"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
                
                <div className="mt-2 space-y-0.5 pl-8">
                    <div className="flex items-center text-[10px] text-gray-500">
                        <span className="text-gray-400 w-11 flex-shrink-0">Created</span>
                        <span className="truncate">
                            {new Date(a.created_at + (a.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString(undefined, {
                                month: 'numeric',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </span>
                    </div>
                    <div className="flex items-center text-[10px] text-gray-500">
                        <span className="text-gray-400 w-11 flex-shrink-0">Updated</span>
                        <span className="truncate font-medium text-gray-600">
                            {new Date(a.updated_at + (a.updated_at.endsWith('Z') ? '' : 'Z')).toLocaleString(undefined, {
                                month: 'numeric',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </span>
                    </div>
                </div>
            </li>
        );
    }
);

interface SortableArticleItemProps extends Omit<ArticleItemProps, 'dragAttributes' | 'dragListeners' | 'isDragging' | 'isOverlay'> {}

export function SortableArticleItem(props: SortableArticleItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: props.article.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <ArticleItem
        ref={setNodeRef}
        style={style}
        isDragging={isDragging}
        dragAttributes={attributes}
        dragListeners={listeners}
        {...props}
    />
  );
}
