export type StreamControlAction = 'pause' | 'resume' | 'cancel'

export interface StreamControlMessage {
  type: 'streamControl'
  payload: { id: string; action: StreamControlAction }
}

interface FlowTarget {
  write(chunk: Buffer): unknown
  once?(event: 'drain', listener: () => void): unknown
}

interface PausableStream {
  pause(): unknown
  resume(): unknown
  destroyed?: boolean
}

export const isStreamControlMessage = (
  msg: unknown
): msg is StreamControlMessage => {
  if (!msg || typeof msg !== 'object') return false
  const candidate = msg as { type?: unknown; payload?: unknown }
  if (candidate.type !== 'streamControl') return false
  const payload = candidate.payload as
    | { id?: unknown; action?: unknown }
    | undefined
  return (
    typeof payload?.id === 'string' &&
    (payload.action === 'pause' ||
      payload.action === 'resume' ||
      payload.action === 'cancel')
  )
}

export class StreamFlowGate {
  private paused = false
  private readonly target: FlowTarget
  private readonly signal: (action: StreamControlAction) => void

  constructor(
    target: FlowTarget,
    signal: (action: StreamControlAction) => void
  ) {
    this.target = target
    this.signal = signal
  }

  get isPaused(): boolean {
    return this.paused
  }

  write(chunk: Buffer): void {
    const accepted = this.target.write(chunk)
    if (accepted !== false || this.paused) return
    if (typeof this.target.once !== 'function') return

    this.paused = true
    this.signal('pause')
    this.target.once('drain', () => {
      this.paused = false
      this.signal('resume')
    })
  }
}

interface ControlledStreamEntry {
  stream: PausableStream | null
  paused: boolean
  cancel: () => void
}

export class StreamControlRegistry {
  private readonly entries = new Map<string, ControlledStreamEntry>()

  get size(): number {
    return this.entries.size
  }

  register(id: string, cancel: () => void): void {
    this.entries.set(id, { stream: null, paused: false, cancel })
  }

  attach(id: string, stream: PausableStream): void {
    const entry = this.entries.get(id)
    if (!entry) return
    entry.stream = stream
    if (entry.paused) stream.pause()
  }

  apply(id: string, action: StreamControlAction): void {
    const entry = this.entries.get(id)
    if (!entry) return

    if (action === 'cancel') {
      this.entries.delete(id)
      entry.cancel()
      return
    }

    entry.paused = action === 'pause'
    const stream = entry.stream
    if (!stream || stream.destroyed) return
    if (entry.paused) stream.pause()
    else stream.resume()
  }

  release(id: string): void {
    this.entries.delete(id)
  }
}
