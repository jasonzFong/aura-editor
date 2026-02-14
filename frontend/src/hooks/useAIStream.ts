import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

export const useAIStream = () => {
  const { token } = useAuth()
  const [streaming, setStreaming] = useState(false)

  const analyzeText = useCallback(async (text: string, context: string, existingQuotes: string[] = [], onChunk: (chunk: string) => void, onComplete?: (fullText: string) => void) => {
    if (!token) return

    setStreaming(true)
    let fullText = ''
    try {
      const response = await fetch('http://localhost:8000/api/v1/ai/analyze/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text, context, existing_quotes: existingQuotes })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('AI Stream Error:', errorText)
        if (response.status === 401) {
            onChunk('Authentication expired. Please login again.')
        } else {
            onChunk(`Error: ${errorText}`)
        }
        return
      }

      if (!response.body) return

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        fullText += chunk
        onChunk(chunk)
      }
      
      if (onComplete) {
          onComplete(fullText)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setStreaming(false)
    }
  }, [token])

  return { analyzeText, streaming }
}
