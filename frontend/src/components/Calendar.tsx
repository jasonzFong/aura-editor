import { useState, useMemo, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, addYears, subYears, getYear, startOfYear, eachMonthOfInterval, startOfDay, addDays } from 'date-fns'
// @ts-ignore
import { Solar, Lunar } from 'lunar-javascript'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import api from '../services/api'
import EventModal from './EventModal'
import DayEventsModal from './DayEventsModal'

type CalendarView = 'year' | 'month' | 'week'

interface CalendarEvent {
    id: number
    title: string
    start_time: string
    end_time: string
    color: string
    is_all_day: boolean
    description?: string
}

const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [today, setToday] = useState(new Date())
  const [view, setView] = useState<CalendarView>('month')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [isDayEventsModalOpen, setIsDayEventsModalOpen] = useState(false)

  const fetchEvents = async () => {
      try {
          // Fetch range based on view. For simplicity, fetch +/- 2 months from currentDate
          const start = startOfMonth(subMonths(currentDate, 2))
          const end = endOfMonth(addMonths(currentDate, 2))
          const res = await api.get('/events/', {
              params: {
                  start: start.toISOString(),
                  end: end.toISOString()
              }
          })
          setEvents(res.data)
      } catch (error) {
          console.error("Failed to fetch events", error)
      }
  }

  useEffect(() => {
      fetchEvents()
  }, [currentDate, view])

  const handleDayDoubleClick = (date: Date) => {
      setSelectedDate(date)
      setEditingEvent(null)
      setIsEventModalOpen(true)
  }

  const handleEditEvent = (event: CalendarEvent) => {
      setEditingEvent(event)
      setIsEventModalOpen(true)
  }

  const handleViewMore = (date: Date) => {
      setSelectedDate(date)
      setIsDayEventsModalOpen(true)
  }

  // Auto-refresh 'today' every minute to ensure the calendar stays current
  useEffect(() => {
      const timer = setInterval(() => {
          const now = new Date()
          if (!isSameDay(now, today)) {
              setToday(now)
              // If user hasn't navigated away, update view too? 
              // Maybe better not to jump user around, but updating 'today' marker is good.
          }
      }, 60000)
      return () => clearInterval(timer)
  }, [today])

  // Navigation Logic
  const handleNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1))
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1))
    else if (view === 'year') setCurrentDate(addYears(currentDate, 1))
  }

  const handlePrev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1))
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1))
    else if (view === 'year') setCurrentDate(subYears(currentDate, 1))
  }

  const handleToday = () => {
      setCurrentDate(new Date())
  }

  // Lunar Helper - DISABLED
  const getLunarText = (date: Date) => {
      // Lunar Date removed as per request
      return null
  }

  // Hand-drawn circle SVG
  const handDrawnCircle = (
    <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] text-red-500 pointer-events-none z-0 opacity-90" viewBox="0 0 100 100" style={{ transform: 'translate(-50%, -50%) rotate(-5deg)' }}>
      <path 
        d="M20,50 C20,25 35,10 55,10 C80,10 95,25 95,50 C95,80 75,95 50,95 C25,95 10,75 10,50 C10,35 15,25 25,20" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="3" 
        strokeLinecap="round"
        className="path-draw"
      />
    </svg>
  )

  const DailyFortune = () => {
      const [almanac, setAlmanac] = useState<{yi: string[], ji: string[], icon?: string} | null>(null)
      const [loading, setLoading] = useState(false)
      const [error, setError] = useState(false)
      
      // Always use today's date
      const todayDate = useMemo(() => new Date(), [])

      // Fetch Almanac from Backend
      useEffect(() => {
          const fetchAlmanac = async () => {
              setLoading(true)
              setError(false)
              try {
                  const dateStr = format(todayDate, 'yyyy-MM-dd')
                  const res = await api.get(`/almanac/?target_date=${dateStr}`)
                  setAlmanac(res.data)
              } catch (err) {
                  // If 404 or error, hide module (setError true)
                  setError(true)
                  setAlmanac(null)
              } finally {
                  setLoading(false)
              }
          }
          fetchAlmanac()
      }, []) // Empty dependency array: only fetch once on mount

      // Calculate Lunar Date String (Local)
      const lunarDateStr = useMemo(() => {
          const solar = Solar.fromYmd(todayDate.getFullYear(), todayDate.getMonth() + 1, todayDate.getDate())
          const lunar = solar.getLunar() as any
          
          const monthMapping: Record<string, string> = {
            "正月": "Jan", "二月": "Feb", "三月": "Mar", "四月": "Apr", "五月": "May", "六月": "Jun",
            "七月": "Jul", "八月": "Aug", "九月": "Sep", "十月": "Oct", "冬月": "Nov", "腊月": "Dec",
            "正": "Jan", "一": "Jan", "二": "Feb", "三": "Mar", "四": "Apr", "五": "May", "六": "Jun",
            "七": "Jul", "八": "Aug", "九": "Sep", "十": "Oct", "冬": "Nov", "腊": "Dec",
            "闰正月": "Leap Jan", "闰二月": "Leap Feb", "闰三月": "Leap Mar", "闰四月": "Leap Apr",
            "闰五月": "Leap May", "闰六月": "Leap Jun", "闰七月": "Leap Jul", "闰八月": "Leap Aug",
            "闰九月": "Leap Sep", "闰十月": "Leap Oct", "闰冬月": "Leap Nov", "闰腊月": "Leap Dec"
          }
          
          const dayMapping: Record<string, string> = {
            "初一": "1st", "初二": "2nd", "初三": "3rd", "初四": "4th", "初五": "5th",
            "初六": "6th", "初七": "7th", "初八": "8th", "初九": "9th", "初十": "10th",
            "十一": "11th", "十二": "12th", "十三": "13th", "十四": "14th", "十五": "15th",
            "十六": "16th", "十七": "17th", "十八": "18th", "十九": "19th", "二十": "20th",
            "廿一": "21st", "廿二": "22nd", "廿三": "23rd", "廿四": "24th", "廿五": "25th",
            "廿六": "26th", "廿七": "27th", "廿八": "28th", "廿九": "29th", "三十": "30th"
          }

          const m = lunar.getMonthInChinese()
          const d = lunar.getDayInChinese()
          return `${monthMapping[m] || m} ${dayMapping[d] || d}`
      }, [todayDate])

      return (
          <div className="bg-gradient-to-br from-orange-50 to-amber-50/50 border border-orange-100 rounded-2xl p-4 mb-4 flex items-start gap-5 shadow-sm hover:shadow-md transition-shadow duration-300 w-1/2 relative">
              <div className="absolute top-0 left-0 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-br-lg rounded-tl-2xl shadow-sm z-10">
                  TODAY
              </div>
              <div className="bg-white p-3.5 rounded-2xl shadow-sm text-3xl flex items-center justify-center shrink-0 mt-1">
                  {almanac?.icon || "📅"}
              </div>
              <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-gray-800 text-lg">Daily Almanac</h3>
                      <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                          {format(todayDate, 'MMM d')} · {lunarDateStr} (Lunar)
                      </span>
                  </div>
                  
                  {!error && !loading && almanac && (
                      <div className="flex flex-col gap-2 text-sm select-text">
                          <div className="flex items-center gap-2 p-1 group relative cursor-help">
                              <span className="inline-flex shrink-0 px-2 h-6 rounded-full bg-emerald-100 text-emerald-600 items-center justify-center text-xs font-bold ring-1 ring-emerald-200 select-none">Good</span>
                              <span className="text-gray-600 truncate leading-6 flex-1">{almanac.yi.slice(0, 3).join(', ')}...</span>
                              <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-50 w-64 p-3 bg-white rounded-lg shadow-xl border border-gray-100 text-gray-700 text-xs whitespace-normal break-words">
                                  <strong className="select-none">Suitable for:</strong> {almanac.yi.join(', ')}
                              </div>
                          </div>
                          <div className="flex items-center gap-2 p-1 group relative cursor-help">
                              <span className="inline-flex shrink-0 px-2 h-6 rounded-full bg-rose-100 text-rose-600 items-center justify-center text-xs font-bold ring-1 ring-rose-200 select-none">Bad</span>
                              <span className="text-gray-600 truncate leading-6 flex-1">{almanac.ji.slice(0, 3).join(', ')}...</span>
                              <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-50 w-64 p-3 bg-white rounded-lg shadow-xl border border-gray-100 text-gray-700 text-xs whitespace-normal break-words">
                                  <strong className="select-none">Avoid:</strong> {almanac.ji.join(', ')}
                              </div>
                          </div>
                      </div>
                  )}
                  {loading && (
                       <div className="text-sm text-gray-400 animate-pulse">Loading...</div>
                  )}
              </div>
          </div>
      )
  }

  // View Components
  const MonthGrid = ({ date, isMini = false, onClickDay }: { date: Date, isMini?: boolean, onClickDay?: (d: Date) => void }) => {
      const monthStart = startOfMonth(date)
      const monthEnd = endOfMonth(monthStart)
      const startDate = startOfWeek(monthStart)
      const endDate = endOfWeek(monthEnd)
      
      const days = eachDayOfInterval({ start: startDate, end: endDate })
      const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

      return (
          <div className="w-full h-full overflow-y-auto custom-scrollbar p-1">
              {!isMini && (
                  <div className="grid grid-cols-7 mb-4">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                        <div key={day} className={`text-center text-sm font-semibold text-gray-400 uppercase tracking-widest py-2 ${(index === 0 || index === 6) ? 'bg-gray-50/50 rounded-lg' : ''}`}>
                            {day}
                        </div>
                    ))}
                  </div>
              )}
              {isMini && (
                   <div className="grid grid-cols-7 mb-1">
                    {weekDays.map((day, index) => (
                        <div key={index} className={`text-center text-[10px] font-medium text-gray-300 ${(index === 0 || index === 6) ? 'bg-gray-50/50 rounded-sm' : ''}`}>
                            {day}
                        </div>
                    ))}
                  </div>
              )}
              <div className={`grid grid-cols-7 ${isMini ? 'gap-y-1 gap-x-1' : 'gap-y-2'}`}>
                  {days.map(day => {
                      const isToday = isSameDay(day, today)
                      const isCurrentMonth = isSameMonth(day, monthStart)
                      const isSelected = isSameDay(day, currentDate) && !isMini
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6
                      const dayStart = startOfDay(day)
                      const dayNext = addDays(dayStart, 1)
                      
                      const dayEvents = events.filter(e => {
                          const eventStart = new Date(e.start_time)
                          const eventEnd = new Date(e.end_time)
                          // Check if event overlaps with this day
                          // Logic: Event ends after day starts AND event starts before day ends
                          return eventEnd > dayStart && eventStart < dayNext
                      })

                      if (isMini && !isCurrentMonth) return <div key={day.toString()} />

                      return (
                          <div 
                            key={day.toString()}
                            onClick={() => onClickDay && onClickDay(day)}
                            onDoubleClick={() => !isMini && handleDayDoubleClick(day)}
                            className={`relative flex flex-col items-center justify-start pt-1 rounded-lg transition-all
                                ${isMini ? 'h-6 text-[10px]' : 'h-28 cursor-pointer'}
                                ${isWeekend ? 'bg-gray-50/50' : ''}
                                ${!isMini && isWeekend ? 'hover:bg-gray-100' : ''}
                                ${!isMini && !isWeekend ? 'hover:bg-gray-50' : ''}
                                ${!isCurrentMonth ? 'opacity-20' : ''}
                            `}
                          >
                              {isToday && !isMini && handDrawnCircle}
                              {isToday && isMini && (
                                  <div className="absolute inset-0 bg-red-500 rounded-full opacity-20"></div>
                              )}
                              
                              <span className={`z-10 font-medium relative mb-1 ${
                                  isToday ? 'text-red-600 font-bold' : 'text-gray-700'
                              } ${isMini && isToday ? 'text-red-600' : ''}`}>
                                  {format(day, 'd')}
                              </span>
                              
                              {!isMini && (
                                  <div className="flex flex-col gap-0.5 w-full px-1 z-10">
                                      {dayEvents.slice(0, 3).map(e => (
                                          <div 
                                            key={e.id} 
                                            className={`text-[9px] px-1.5 py-0.5 rounded truncate text-white shadow-sm font-medium hover:brightness-110 cursor-pointer flex items-center gap-1`}
                                            style={{ backgroundColor: e.color === 'blue' ? '#3b82f6' : e.color === 'red' ? '#ef4444' : e.color === 'green' ? '#10b981' : e.color === 'orange' ? '#f97316' : '#8b5cf6' }}
                                            title={`${e.title}\n${format(new Date(e.start_time), 'HH:mm')} - ${format(new Date(e.end_time), 'HH:mm')}${e.description ? `\n\n${e.description}` : ''}`}
                                            onClick={(ev) => {
                                                ev.stopPropagation()
                                                handleEditEvent(e)
                                            }}
                                          >
                                              <span className="opacity-90">{format(new Date(e.start_time), 'HH:mm')}</span>
                                              <span className="truncate">{e.title}</span>
                                          </div>
                                      ))}
                                      {dayEvents.length > 3 && (
                                          <div 
                                            className="text-[9px] text-gray-400 pl-1 cursor-pointer hover:text-blue-500"
                                            onClick={(ev) => {
                                                ev.stopPropagation()
                                                handleViewMore(day)
                                            }}
                                          >
                                              +{dayEvents.length - 3} more
                                          </div>
                                      )}
                                  </div>
                              )}
                              {isMini && dayEvents.length > 0 && (
                                  <div className="w-1 h-1 rounded-full bg-blue-500 absolute bottom-0.5"></div>
                              )}
                          </div>
                      )
                  })}
              </div>
          </div>
      )
  }

  const YearView = () => {
      const yearStart = startOfYear(currentDate)
      const months = eachMonthOfInterval({
          start: yearStart,
          end: endOfMonth(addMonths(yearStart, 11))
      })

      return (
          <div className="grid grid-cols-3 gap-x-8 gap-y-10 animate-fade-in">
              {months.map(month => (
                  <div key={month.toString()} className="cursor-pointer hover:scale-105 transition-transform duration-200" onClick={() => {
                      setCurrentDate(month)
                      setView('month')
                  }}>
                      <div className="text-lg font-bold text-gray-800 mb-3 ml-1">{format(month, 'MMMM')}</div>
                      <MonthGrid date={month} isMini={true} />
                  </div>
              ))}
          </div>
      )
  }

  const WeekView = () => {
      const startDate = startOfWeek(currentDate)
      const endDate = endOfWeek(currentDate)
      const days = eachDayOfInterval({ start: startDate, end: endDate })
      const hours = Array.from({ length: 24 }, (_, i) => i) // 0-23 hours

      return (
          <div className="flex flex-col h-full overflow-hidden animate-fade-in">
             <div className="grid grid-cols-8 border-b border-gray-100 pb-2">
                 <div className="w-16"></div> {/* Time column spacer */}
                 {days.map(day => {
                     const isToday = isSameDay(day, today)
                     const isWeekend = day.getDay() === 0 || day.getDay() === 6
                     return (
                         <div key={day.toString()} className={`text-center pt-2 ${isWeekend ? 'bg-gray-50/50 rounded-t-lg' : ''}`}>
                             <div className={`text-xs font-medium uppercase mb-1 ${isToday ? 'text-red-500' : 'text-gray-400'}`}>
                                 {format(day, 'EEE')}
                             </div>
                             <div className={`text-xl flex flex-col items-center justify-center h-10 w-10 mx-auto rounded-full ${
                                 isToday ? 'bg-red-500 text-white shadow-md' : 'text-gray-800'
                             }`}>
                                 {format(day, 'd')}
                             </div>
                             <div className="text-[10px] text-gray-400 mt-1">
                                 {getLunarText(day)}
                             </div>
                         </div>
                     )
                 })}
             </div>
             
             {/* All-Day Events Row */}
             <div className="grid grid-cols-8 border-b border-gray-100 bg-gray-50/10">
                 <div className="col-span-1 border-r border-gray-50 p-2 text-xs text-gray-400 text-right font-medium">
                     All-day
                 </div>
                 <div className="col-span-7 grid grid-cols-7">
                     {days.map((day, i) => {
                         const allDayEvents = events.filter(e => isSameDay(new Date(e.start_time), day) && e.is_all_day)
                         const isWeekend = day.getDay() === 0 || day.getDay() === 6
                         return (
                             <div key={i} className={`p-1 flex flex-col gap-1 border-r border-gray-50 last:border-0 ${isWeekend ? 'bg-gray-50/30' : ''}`}>
                                 {allDayEvents.map(e => (
                                     <div 
                                         key={e.id}
                                         className="text-[10px] px-1.5 py-0.5 rounded text-white shadow-sm font-medium truncate cursor-pointer hover:brightness-110"
                                         style={{ backgroundColor: e.color === 'blue' ? '#3b82f6' : e.color === 'red' ? '#ef4444' : e.color === 'green' ? '#10b981' : e.color === 'orange' ? '#f97316' : '#8b5cf6' }}
                                         title={`${e.title}${e.description ? `\n\n${e.description}` : ''}`}
                                         onClick={(ev) => {
                                             ev.stopPropagation()
                                             handleEditEvent(e)
                                         }}
                                     >
                                         {e.title}
                                     </div>
                                 ))}
                             </div>
                         )
                     })}
                 </div>
             </div>

             <div className="flex-1 overflow-y-auto relative custom-scrollbar pt-2">
                 <div className="grid grid-cols-8 relative min-h-[600px]">
                     {/* Time Labels */}
                     <div className="col-span-1 border-r border-gray-50 relative">
                         {hours.map(hour => (
                             <div 
                                 key={hour} 
                                 className="absolute right-2 text-xs text-gray-300 -translate-y-1/2"
                                 style={{ top: `${hour * 3.5}rem` }}
                             >
                                 {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                             </div>
                         ))}
                     </div>
                     {/* Grid Lines */}
                     <div className="col-span-7 relative">
                         {hours.map(hour => (
                             <div key={hour} className="h-14 border-b border-gray-50 w-full absolute" style={{ top: `${hour * 3.5}rem` }}></div>
                         ))}
                         <div className="absolute inset-0 grid grid-cols-7 h-full pointer-events-none">
                             {days.map((day, i) => {
                                 const isWeekend = day.getDay() === 0 || day.getDay() === 6
                                 const dayStart = startOfDay(day)
                                 const dayNext = addDays(dayStart, 1)
                                 
                                 const dayEvents = events.filter(e => {
                                     if (e.is_all_day) return false
                                     const eventStart = new Date(e.start_time)
                                     const eventEnd = new Date(e.end_time)
                                     // Check if event overlaps with this day
                                     return eventStart < dayNext && eventEnd > dayStart
                                 })

                                 // Layout Logic for Overlapping Events
                                 const nodes = dayEvents.map(e => {
                                    const eventStart = new Date(e.start_time)
                                    const eventEnd = new Date(e.end_time)
                                    const visualStart = eventStart < dayStart ? dayStart : eventStart
                                    const visualEnd = eventEnd > dayNext ? dayNext : eventEnd
                                    return {
                                        event: e,
                                        start: visualStart.getTime(),
                                        end: visualEnd.getTime(),
                                        visualStart,
                                        visualEnd
                                    }
                                 }).sort((a, b) => a.start - b.start || b.end - a.end)

                                 const clusters: typeof nodes[] = []
                                 let currentCluster: typeof nodes = []
                                 let clusterEnd = 0

                                 nodes.forEach(node => {
                                     if (currentCluster.length === 0) {
                                         currentCluster.push(node)
                                         clusterEnd = node.end
                                     } else {
                                         if (node.start < clusterEnd) {
                                             currentCluster.push(node)
                                             clusterEnd = Math.max(clusterEnd, node.end)
                                         } else {
                                             clusters.push(currentCluster)
                                             currentCluster = [node]
                                             clusterEnd = node.end
                                         }
                                     }
                                 })
                                 if (currentCluster.length > 0) clusters.push(currentCluster)

                                 const positionedEvents = clusters.flatMap(cluster => {
                                     const columns: number[] = [] 
                                     const clusterWithPos = cluster.map(node => {
                                         let colIndex = -1
                                         for (let c = 0; c < columns.length; c++) {
                                             if (columns[c] <= node.start) {
                                                 colIndex = c
                                                 columns[c] = node.end
                                                 break
                                             }
                                         }
                                         if (colIndex === -1) {
                                             colIndex = columns.length
                                             columns.push(node.end)
                                         }
                                         return { ...node, colIndex }
                                     })
                                     
                                     const numCols = columns.length
                                     return clusterWithPos.map(node => {
                                         const startHour = node.visualStart.getHours() + node.visualStart.getMinutes() / 60
                                         let durationHours = (node.visualEnd.getTime() - node.visualStart.getTime()) / (1000 * 60 * 60)
                                         if (durationHours < 0.25) durationHours = 0.25

                                         // Layout Style Logic
                                        // Use cascading overlap for ALL collisions to maximize width and readability
                                        // Each subsequent column is indented, but takes up most of the remaining width
                                         const indentPercent = 8 // Indent 8% per overlapping level
                                         const left = `${node.colIndex * indentPercent}%`
                                         const width = `calc(100% - ${node.colIndex * indentPercent}%)` // Extend to the right edge
                                         const zIndex = 20 + node.colIndex

                                         // Determine if this event is being overlapped by a later event in the same cluster
                                         // Find all events that overlap this one and have a higher colIndex
                                         const obscuringEvents = clusterWithPos.filter(n => 
                                             n.colIndex > node.colIndex && 
                                             n.start < node.end && n.end > node.start
                                         ).sort((a, b) => a.start - b.start)

                                         // Calculate the visual Y position for the text
                                         // Start at the event's start time
                                         let textVisualStart = node.start
                                         let changed = true
                                         
                                         // Iterate to find the first "gap" in overlapping events
                                         while (changed && textVisualStart < node.end) {
                                             changed = false
                                             for (const h of obscuringEvents) {
                                                 // If the higher event overlaps the current text position
                                                 if (h.start <= textVisualStart && h.end > textVisualStart) {
                                                     // Move the text position to the end of this overlapping event
                                                     textVisualStart = h.end
                                                     changed = true
                                                 }
                                             }
                                         }
                                         
                                         // Calculate top padding in REM
                                         // 1 hour = 3.5rem
                                         // difference in hours = (textVisualStart - node.start) / (1000 * 60 * 60)
                                         const paddingHours = (textVisualStart - node.start) / (1000 * 60 * 60)
                                         const paddingTop = `${Math.max(0, paddingHours * 3.5)}rem`

                                         return {
                                             event: node.event,
                                             style: {
                                                 top: `${startHour * 3.5}rem`,
                                                 height: `${durationHours * 3.5}rem`,
                                                 left,
                                                 width,
                                                 zIndex,
                                                 paddingTop
                                             },
                                             visualStart: node.visualStart,
                                             visualEnd: node.visualEnd
                                         }
                                     })
                                 })
                                 
                                 return (
                                     <div key={i} className={`relative h-full ${isWeekend ? 'bg-gray-50/50' : ''}`}>
                                         {positionedEvents.map(({ event: e, style, visualStart, visualEnd }) => (
                                             <div 
                                                 key={e.id}
                                                 className="absolute rounded px-1 text-[10px] text-white overflow-hidden shadow-sm pointer-events-auto cursor-pointer hover:brightness-110 transition-all min-h-[1.5rem] hover:z-50 flex flex-col justify-start"
                                                 style={{
                                                     ...style,
                                                     backgroundColor: e.color === 'blue' ? '#3b82f6' : e.color === 'red' ? '#ef4444' : e.color === 'green' ? '#10b981' : e.color === 'orange' ? '#f97316' : '#8b5cf6',
                                                     border: '1px solid white',
                                                     boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                 }}
                                                 title={`${e.title} (${format(visualStart, 'HH:mm')} - ${format(visualEnd, 'HH:mm')})${e.description ? `\n\n${e.description}` : ''}`}
                                                 onClick={(ev) => {
                                                     ev.stopPropagation()
                                                     handleEditEvent(e)
                                                 }}
                                             >
                                                 <div className="font-semibold truncate">{e.title}</div>
                                                 {parseFloat(style.height as string) > 1.75 && <div className="truncate opacity-90">{format(visualStart, 'HH:mm')}</div>}
                                             </div>
                                         ))}
                                     </div>
                                 )
                             })}
                         </div>
                         {/* Current Time Indicator (if today) */}
                         {isSameDay(currentDate, today) && ( // Simplified: only show if viewing current week containing today
                             <div 
                                className="absolute left-0 right-0 border-t-2 border-red-400 z-10 pointer-events-none"
                                style={{ top: `${(today.getHours() + today.getMinutes() / 60) * 3.5}rem` }}
                             >
                                 <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-red-500 rounded-full"></div>
                             </div>
                         )}
                     </div>
                 </div>
             </div>
          </div>
      )
  }

  // Header
  const getHeaderTitle = () => {
      if (view === 'year') return format(currentDate, 'yyyy')
      if (view === 'month') return format(currentDate, 'MMMM yyyy')
      if (view === 'week') return format(currentDate, 'MMMM yyyy')
      return ''
  }

  return (
    <div className="bg-white p-6 rounded-[40px] shadow-sm border border-gray-100 w-full h-full mx-auto select-none font-sans flex flex-col transition-all duration-500">
      <header className="flex justify-between items-center mb-4 px-2 flex-shrink-0">
        <div className="flex items-center gap-6">
            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight flex items-baseline gap-3">
                {getHeaderTitle()}
                {view !== 'year' && <span className="text-lg font-normal text-gray-400">{view === 'week' ? 'Week ' + format(currentDate, 'w') : ''}</span>}
            </h2>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <button onClick={handlePrev} className="p-1.5 hover:bg-white rounded-md text-gray-500 hover:shadow-sm transition-all">
                    <ChevronLeft size={20} />
                </button>
                <button onClick={handleToday} className="px-3 text-sm font-medium text-gray-600 hover:bg-white rounded-md transition-all">
                    Today
                </button>
                <button onClick={handleNext} className="p-1.5 hover:bg-white rounded-md text-gray-500 hover:shadow-sm transition-all">
                    <ChevronRight size={20} />
                </button>
            </div>
        </div>

        <div className="bg-gray-100 p-1 rounded-xl flex text-sm font-medium">
            {(['year', 'month', 'week'] as CalendarView[]).map(v => (
                <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`px-6 py-2 rounded-lg capitalize transition-all duration-200 ${
                        view === v 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    {v}
                </button>
            ))}
        </div>
      </header>

      {/* Daily Fortune Module - Always shows Today's Fortune */}
      {view === 'month' && <DailyFortune />}

      <div className="flex-1 overflow-hidden relative">
          {view === 'month' && <MonthGrid date={currentDate} />}
          {view === 'year' && <YearView />}
          {view === 'week' && <WeekView />}
      </div>

      <EventModal 
          isOpen={isEventModalOpen} 
          onClose={() => setIsEventModalOpen(false)} 
          date={selectedDate}
          onEventCreated={fetchEvents}
          initialEvent={editingEvent}
      />

      <DayEventsModal 
          isOpen={isDayEventsModalOpen}
          onClose={() => setIsDayEventsModalOpen(false)}
          date={selectedDate}
          events={events.filter(e => {
              if (!selectedDate) return false
              const dayStart = startOfDay(selectedDate)
              const dayNext = addDays(dayStart, 1)
              const eventStart = new Date(e.start_time)
              const eventEnd = new Date(e.end_time)
              return eventEnd > dayStart && eventStart < dayNext
          })}
          onEditEvent={(event) => {
              setIsDayEventsModalOpen(false)
              handleEditEvent(event)
          }}
      />
    </div>
  )
}

export default Calendar
