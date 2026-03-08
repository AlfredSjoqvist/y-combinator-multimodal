import { useState, useEffect, useRef, useCallback } from 'react'

interface LogEntry {
  level: 'log' | 'warn' | 'error'
  message: string
  time: string
}

const MAX_LOGS = 200

export function DebugConsole() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [visible, setVisible] = useState(false)
  const [errorCount, setErrorCount] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const origLog = console.log
    const origWarn = console.warn
    const origError = console.error

    const addLog = (level: LogEntry['level'], args: unknown[]) => {
      const message = args.map(a =>
        typeof a === 'string' ? a :
        a instanceof Error ? `${a.message}\n${a.stack}` :
        JSON.stringify(a, null, 0)?.slice(0, 300) || String(a)
      ).join(' ')
      const time = new Date().toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 1 } as Intl.DateTimeFormatOptions)
      setLogs(prev => [...prev.slice(-MAX_LOGS), { level, message, time }])
      if (level === 'error') setErrorCount(c => c + 1)
    }

    console.log = (...args: unknown[]) => { origLog.apply(console, args); addLog('log', args) }
    console.warn = (...args: unknown[]) => { origWarn.apply(console, args); addLog('warn', args) }
    console.error = (...args: unknown[]) => { origError.apply(console, args); addLog('error', args) }

    // Capture unhandled errors
    const onError = (e: ErrorEvent) => addLog('error', [`Unhandled: ${e.message} at ${e.filename}:${e.lineno}`])
    const onRejection = (e: PromiseRejectionEvent) => addLog('error', [`Unhandled Promise: ${e.reason}`])
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)

    return () => {
      console.log = origLog
      console.warn = origWarn
      console.error = origError
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    if (visible && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, visible])

  const toggle = useCallback(() => {
    setVisible(v => !v)
    setErrorCount(0)
  }, [])

  const levelColor = { log: '#8b8', warn: '#eb8', error: '#f66' }

  return (
    <>
      {/* Toggle button */}
      <div
        onClick={toggle}
        style={{
          position: 'fixed', bottom: 8, right: 8, zIndex: 9999,
          width: 36, height: 36, borderRadius: '50%',
          background: errorCount > 0 ? '#ef4444' : 'rgba(30,30,40,0.8)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 14, color: '#fff', fontWeight: 700,
          boxShadow: errorCount > 0 ? '0 0 12px #ef4444' : 'none',
        }}
      >
        {errorCount > 0 ? errorCount : visible ? 'X' : '>'}
      </div>

      {/* Log panel */}
      {visible && (
        <div style={{
          position: 'fixed', bottom: 50, right: 8, zIndex: 9999,
          width: 520, maxHeight: 360, borderRadius: 8,
          background: 'rgba(8,8,12,0.95)', border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'monospace', fontSize: 11,
        }}>
          <div style={{
            padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ color: '#888', fontWeight: 600 }}>Debug Console ({logs.length})</span>
            <span onClick={() => setLogs([])} style={{ color: '#666', cursor: 'pointer', fontSize: 10 }}>Clear</span>
          </div>
          <div ref={scrollRef} style={{
            flex: 1, overflowY: 'auto', padding: '4px 8px',
            maxHeight: 320,
          }}>
            {logs.map((l, i) => (
              <div key={i} style={{
                padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.02)',
                color: levelColor[l.level], wordBreak: 'break-all',
                lineHeight: 1.3,
              }}>
                <span style={{ color: '#555', marginRight: 6 }}>{l.time}</span>
                <span style={{ color: levelColor[l.level], fontWeight: l.level === 'error' ? 700 : 400 }}>
                  {l.level === 'error' ? 'ERR ' : l.level === 'warn' ? 'WRN ' : ''}
                </span>
                {l.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
