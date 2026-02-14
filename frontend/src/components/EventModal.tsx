import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { X, Trash2 } from 'lucide-react'
import api from '../services/api'

interface CalendarEvent {
    id: number
    title: string
    start_time: string
    end_time: string
    color: string
    is_all_day: boolean
    description?: string
}

interface EventModalProps {
    isOpen: boolean
    onClose: () => void
    date: Date | null
    onEventCreated: () => void
    initialEvent?: CalendarEvent | null
}

export default function EventModal({ isOpen, onClose, date, onEventCreated, initialEvent }: EventModalProps) {
    const [title, setTitle] = useState('')
    const [startTime, setStartTime] = useState('')
    const [endTime, setEndTime] = useState('')
    const [description, setDescription] = useState('')
    const [color, setColor] = useState('blue')
    const [isAllDay, setIsAllDay] = useState(false)

    useEffect(() => {
        if (isOpen) {
            if (initialEvent) {
                // Edit Mode
                setTitle(initialEvent.title)
                setStartTime(format(new Date(initialEvent.start_time), "yyyy-MM-dd'T'HH:mm"))
                setEndTime(format(new Date(initialEvent.end_time), "yyyy-MM-dd'T'HH:mm"))
                setDescription(initialEvent.description || '')
                setColor(initialEvent.color)
                setIsAllDay(initialEvent.is_all_day)
            } else if (date) {
                // Create Mode
                setTitle('')
                setDescription('')
                setColor('blue')
                setIsAllDay(false)
                
                const start = new Date(date)
                start.setHours(9, 0, 0, 0)
                setStartTime(format(start, "yyyy-MM-dd'T'HH:mm"))

                const end = new Date(date)
                end.setHours(10, 0, 0, 0)
                setEndTime(format(end, "yyyy-MM-dd'T'HH:mm"))
            }
        }
    }, [date, isOpen, initialEvent])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const payload = {
                title,
                description,
                start_time: startTime,
                end_time: endTime,
                is_all_day: isAllDay,
                color
            }

            if (initialEvent) {
                await api.put(`/events/${initialEvent.id}`, payload)
            } else {
                await api.post('/events/', payload)
            }
            
            onEventCreated()
            onClose()
        } catch (error) {
            console.error("Failed to save event", error)
        }
    }

    const handleDelete = async () => {
        if (!initialEvent) return
        if (confirm('Are you sure you want to delete this event?')) {
            try {
                await api.delete(`/events/${initialEvent.id}`)
                onEventCreated()
                onClose()
            } catch (error) {
                console.error("Failed to delete event", error)
            }
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-800">{initialEvent ? 'Edit Event' : 'New Event'}</h3>
                    <div className="flex items-center gap-2">
                        {initialEvent && (
                            <button onClick={handleDelete} className="p-2 hover:bg-red-50 rounded-full text-red-500 transition-colors" title="Delete Event">
                                <Trash2 size={20} />
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            type="text"
                            placeholder="Event Title"
                            className="w-full text-lg font-medium border-b-2 border-gray-200 focus:border-blue-500 outline-none py-2 bg-transparent"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Start</label>
                            <input
                                type="datetime-local"
                                className="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm"
                                value={startTime}
                                onChange={e => setStartTime(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">End</label>
                            <input
                                type="datetime-local"
                                className="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm"
                                value={endTime}
                                onChange={e => setEndTime(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isAllDay}
                                onChange={e => setIsAllDay(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-600">All-day</span>
                        </label>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-2">Color</label>
                        <div className="flex gap-3">
                            {['blue', 'red', 'green', 'orange', 'purple'].map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-300' : ''}`}
                                    style={{ backgroundColor: c === 'blue' ? '#3b82f6' : c === 'red' ? '#ef4444' : c === 'green' ? '#10b981' : c === 'orange' ? '#f97316' : '#8b5cf6' }}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <textarea
                            placeholder="Description (optional)"
                            className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm resize-none focus:ring-2 focus:ring-blue-100 outline-none"
                            rows={3}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            Save Event
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
