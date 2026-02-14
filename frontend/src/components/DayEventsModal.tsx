import { X, Clock } from 'lucide-react'
import { format, isSameDay } from 'date-fns'

interface CalendarEvent {
    id: number
    title: string
    start_time: string
    end_time: string
    color: string
    is_all_day: boolean
    description?: string
}

interface DayEventsModalProps {
    isOpen: boolean
    onClose: () => void
    date: Date | null
    events: CalendarEvent[]
    onEditEvent: (event: CalendarEvent) => void
}

export default function DayEventsModal({ isOpen, onClose, date, events, onEditEvent }: DayEventsModalProps) {
    if (!isOpen || !date) return null

    const sortedEvents = [...events].sort((a, b) => {
        if (a.is_all_day && !b.is_all_day) return -1
        if (!a.is_all_day && b.is_all_day) return 1
        return new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    })

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-fade-in max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">{format(date, 'MMMM d')}</h3>
                        <p className="text-sm text-gray-500">{format(date, 'EEEE')}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="overflow-y-auto flex-1 -mx-2 px-2 custom-scrollbar">
                    {sortedEvents.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            No events for this day
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {sortedEvents.map(event => (
                                <div 
                                    key={event.id}
                                    onClick={() => {
                                        onEditEvent(event)
                                    }}
                                    className="p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer transition-all group"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-1 min-h-[2rem] rounded-full self-stretch shrink-0" 
                                             style={{ backgroundColor: event.color === 'blue' ? '#3b82f6' : event.color === 'red' ? '#ef4444' : event.color === 'green' ? '#10b981' : event.color === 'orange' ? '#f97316' : '#8b5cf6' }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-gray-800 truncate group-hover:text-blue-700">{event.title}</h4>
                                            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                                                <Clock size={12} />
                                                {event.is_all_day ? (
                                                    <span>All-day</span>
                                                ) : (
                                                    <span>
                                                        {(() => {
                                                            const start = new Date(event.start_time)
                                                            const end = new Date(event.end_time)
                                                            if (isSameDay(start, end)) {
                                                                return `${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`
                                                            } else {
                                                                return `${format(start, 'MMM d, h:mm a')} - ${format(end, 'MMM d, h:mm a')}`
                                                            }
                                                        })()}
                                                    </span>
                                                )}
                                            </div>
                                            {event.description && (
                                                <p className="text-xs text-gray-400 mt-2 line-clamp-2">{event.description}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
