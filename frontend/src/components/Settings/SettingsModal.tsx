import { useState, useEffect } from 'react'
import api from '../../services/api'
import Modal from '../UI/Modal'

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: (settings: any) => void;
}

const SettingsModal = ({ isOpen, onClose, onSettingsChange }: SettingsModalProps) => {
  const [activeTab, setActiveTab] = useState<'comments' | 'memory'>('comments')
  const [loading, setLoading] = useState(false)

  // AI Assistant Settings
  const [aiEnabled, setAiEnabled] = useState(true)
  const [intervalValue, setIntervalValue] = useState(30)
  const [intervalUnit, setIntervalUnit] = useState<'s' | 'm' | 'h' | 'd'>('s')
  const [maxCommentsValue, setMaxCommentsValue] = useState(5)
  const [requestIntervalValue, setRequestIntervalValue] = useState(30)
  const [requestIntervalUnit, setRequestIntervalUnit] = useState<'m' | 'h' | 'd'>('m')

  // Background Scan Settings
  const [bgScanEnabled, setBgScanEnabled] = useState(false)
  const [bgScanIntervalValue, setBgScanIntervalValue] = useState(24)
  const [bgScanIntervalUnit, setBgScanIntervalUnit] = useState<'minutes' | 'hours' | 'days'>('hours')
  const [bgScanSkipValue, setBgScanSkipValue] = useState(14)
  const [bgScanSkipUnit, setBgScanSkipUnit] = useState<'days' | 'months' | 'years'>('days')

  useEffect(() => {
    if (isOpen) {
        fetchSettings()
    }
  }, [isOpen])

  const fetchSettings = async () => {
    try {
        const res = await api.get('/user/settings')
        const settings = res.data.settings
        
        // AI Assistant Settings
        if (settings.ai_enabled !== undefined) setAiEnabled(settings.ai_enabled)
        if (settings.max_open_comments !== undefined) setMaxCommentsValue(settings.max_open_comments)
        
        if (settings.ai_interval) {
            let val = settings.ai_interval
            let unit: 's' | 'm' | 'h' | 'd' = 's'
            
            if (val >= 86400000 && val % 86400000 === 0) {
                val /= 86400000
                unit = 'd'
            } else if (val >= 3600000 && val % 3600000 === 0) {
                val /= 3600000
                unit = 'h'
            } else if (val >= 60000 && val % 60000 === 0) {
                val /= 60000
                unit = 'm'
            } else {
                val = Math.floor(val / 1000)
            }
            setIntervalValue(val)
            setIntervalUnit(unit)
        }

        if (settings.article_request_interval !== undefined) {
            let val = settings.article_request_interval
            let unit: 'm' | 'h' | 'd' = 'm'
            
            if (val > 0) {
              if (val >= 86400000 && val % 86400000 === 0) {
                  val /= 86400000
                  unit = 'd'
              } else if (val >= 3600000 && val % 3600000 === 0) {
                  val /= 3600000
                  unit = 'h'
              } else {
                  val = Math.floor(val / 60000)
                  unit = 'm'
              }
              setRequestIntervalValue(val)
              setRequestIntervalUnit(unit)
            } else {
                setRequestIntervalValue(0)
            }
        }
        
        // Background Scan Settings
        if (settings.background_scan) {
            setBgScanEnabled(settings.background_scan.enabled ?? false)
            setBgScanIntervalValue(settings.background_scan.interval_value ?? 24)
            setBgScanIntervalUnit(settings.background_scan.interval_unit ?? 'hours')
            setBgScanSkipValue(settings.background_scan.skip_older_than_value ?? 14)
            setBgScanSkipUnit(settings.background_scan.skip_older_than_unit ?? 'days')
        }

    } catch (err) {
        console.error(err)
    }
  }

  const handleSave = async () => {
      setLoading(true)
      
      // Calculate interval in ms
      let ms = intervalValue * 1000
      if (intervalUnit === 'm') ms *= 60
      if (intervalUnit === 'h') ms *= 3600
      if (intervalUnit === 'd') ms *= 86400
      
      let requestMs = 0
      if (requestIntervalValue > 0) {
          requestMs = requestIntervalValue * 60000 // base minutes
          if (requestIntervalUnit === 'h') requestMs *= 60
          if (requestIntervalUnit === 'd') requestMs *= 1440
      }

      const newSettings = { 
          ai_enabled: aiEnabled,
          ai_interval: ms, 
          max_open_comments: maxCommentsValue,
          article_request_interval: requestMs,
          background_scan: {
              enabled: bgScanEnabled,
              interval_value: bgScanIntervalValue,
              interval_unit: bgScanIntervalUnit,
              skip_older_than_value: bgScanSkipValue,
              skip_older_than_unit: bgScanSkipUnit
          }
      }

      try {
          const res = await api.put('/user/settings', { settings: newSettings })
          onSettingsChange(res.data.settings)
          onClose()
      } catch (err) {
          console.error(err)
      } finally {
          setLoading(false)
      }
  }

  if (!isOpen) return null

  return (
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title="AI Assistant Settings"
        width="600px"
        footer={
            <>
                <button 
                    onClick={onClose}
                    className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleSave}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg shadow-blue-200 hover:bg-blue-700 shadow-sm transition-all transform active:scale-95 disabled:opacity-50 disabled:scale-100"
                >
                    {loading ? 'Saving...' : 'Save Settings'}
                </button>
            </>
        }
    >
        <div className="flex bg-gray-50 p-1 rounded-lg mb-6">
            <button 
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'comments' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('comments')}
            >
                Comments
            </button>
            <button 
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'memory' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('memory')}
            >
                Memory Scanner
            </button>
        </div>

        {activeTab === 'comments' ? (
        <>
        <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
            <label className="flex items-center gap-3 cursor-pointer">
                <div className={`w-10 h-6 flex items-center rounded-full p-1 duration-300 ease-in-out ${aiEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${aiEnabled ? 'translate-x-4' : ''}`}></div>
                </div>
                <input 
                    type="checkbox" 
                    checked={aiEnabled}
                    onChange={e => setAiEnabled(e.target.checked)}
                    className="hidden"
                />
                <span className="font-semibold text-gray-800">Enable AI Assistant</span>
            </label>
        </div>

        <div className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trigger Interval
                </label>
                <div className="flex gap-2">
                    <input 
                        type="number"
                        min="1"
                        value={intervalValue}
                        onChange={e => setIntervalValue(Math.max(1, parseInt(e.target.value) || 1))}
                        className="flex-1 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                        disabled={!aiEnabled}
                    />
                    <select 
                        value={intervalUnit}
                        onChange={e => setIntervalUnit(e.target.value as any)}
                        className="border border-gray-200 rounded-lg p-2.5 outline-none focus:border-blue-500 bg-white min-w-[100px]"
                        disabled={!aiEnabled}
                    >
                        <option value="s">Seconds</option>
                        <option value="m">Minutes</option>
                        <option value="h">Hours</option>
                        <option value="d">Days</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Open Comments (Per Article)
                </label>
                <input 
                    type="number"
                    min="1"
                    max="50"
                    value={maxCommentsValue}
                    onChange={e => setMaxCommentsValue(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                    disabled={!aiEnabled}
                />
                <p className="text-xs text-gray-500 mt-1.5">AI comments will pause if open comments exceed this limit.</p>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Request Interval (Per Article)
                </label>
                <div className="flex gap-2">
                    <input 
                        type="number"
                        min="0"
                        value={requestIntervalValue}
                        onChange={e => setRequestIntervalValue(Math.max(0, parseInt(e.target.value) || 0))}
                        className="flex-1 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                        disabled={!aiEnabled}
                        placeholder="0 (Disabled)"
                    />
                    <select 
                        value={requestIntervalUnit}
                        onChange={e => setRequestIntervalUnit(e.target.value as any)}
                        className="border border-gray-200 rounded-lg p-2.5 outline-none focus:border-blue-500 bg-white min-w-[100px]"
                        disabled={!aiEnabled}
                    >
                        <option value="m">Minutes</option>
                        <option value="h">Hours</option>
                        <option value="d">Days</option>
                    </select>
                </div>
                <p className="text-xs text-gray-500 mt-1.5">Minimum time between AI requests for the same article.</p>
            </div>
        </div>
        </>
        ) : (
        <>
            <div className="mb-6 bg-purple-50 p-4 rounded-xl border border-purple-100">
                <label className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-10 h-6 flex items-center rounded-full p-1 duration-300 ease-in-out ${bgScanEnabled ? 'bg-purple-600' : 'bg-gray-300'}`}>
                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${bgScanEnabled ? 'translate-x-4' : ''}`}></div>
                    </div>
                    <input 
                        type="checkbox" 
                        checked={bgScanEnabled}
                        onChange={e => setBgScanEnabled(e.target.checked)}
                        className="hidden"
                    />
                    <div>
                        <span className="font-semibold text-gray-800 block">Enable Background Scanning</span>
                        <span className="text-xs text-gray-500 block mt-0.5">Regularly scans articles to extract knowledge and preferences.</span>
                    </div>
                </label>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Scan Interval
                    </label>
                    <div className="flex gap-2">
                        <input 
                            type="number"
                            min="1"
                            value={bgScanIntervalValue}
                            onChange={e => setBgScanIntervalValue(Math.max(1, parseInt(e.target.value) || 1))}
                            className="flex-1 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all"
                            disabled={!bgScanEnabled}
                        />
                        <select 
                            value={bgScanIntervalUnit}
                            onChange={e => setBgScanIntervalUnit(e.target.value as any)}
                            className="border border-gray-200 rounded-lg p-2.5 outline-none focus:border-purple-500 bg-white min-w-[100px]"
                            disabled={!bgScanEnabled}
                        >
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                        </select>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">How often the system checks for new content.</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Skip Old Articles
                    </label>
                    <div className="flex gap-2">
                        <input 
                            type="number"
                            min="1"
                            value={bgScanSkipValue}
                            onChange={e => setBgScanSkipValue(Math.max(1, parseInt(e.target.value) || 1))}
                            className="flex-1 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all"
                            disabled={!bgScanEnabled}
                        />
                        <select 
                            value={bgScanSkipUnit}
                            onChange={e => setBgScanSkipUnit(e.target.value as any)}
                            className="border border-gray-200 rounded-lg p-2.5 outline-none focus:border-purple-500 bg-white min-w-[100px]"
                            disabled={!bgScanEnabled}
                        >
                            <option value="days">Days</option>
                            <option value="months">Months</option>
                            <option value="years">Years</option>
                        </select>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">Do not scan articles modified longer ago than this.</p>
                </div>
            </div>
        </>
        )}
    </Modal>
  )
}

export default SettingsModal