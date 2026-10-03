export interface InflightTaskInput {
  id: string
  task: string
  socketPath: string
}

export interface InflightTask<Owner> extends InflightTaskInput {
  owner: Owner
}

const STREAMING_TASKS = new Set(['loadStream', 'loadLiveChat'])
const UNACKNOWLEDGED_TASKS = new Set(['cancelLiveChat', 'streamControl'])
const MAX_CAUSE_DEPTH = 4
const MAX_DETAIL_LENGTH = 4000

export const isStreamingTask = (task: string): boolean =>
  STREAMING_TASKS.has(task)

export class InflightTaskRegistry<Owner> {
  private readonly tasks = new Map<string, InflightTask<Owner>>()

  get size(): number {
    return this.tasks.size
  }

  track(input: InflightTaskInput, owner: Owner): void {
    if (UNACKNOWLEDGED_TASKS.has(input.task)) return
    this.tasks.set(input.id, {
      id: input.id,
      task: input.task,
      socketPath: input.socketPath,
      owner
    })
  }

  settle(id: string): void {
    this.tasks.delete(id)
  }

  drainOwner(owner: Owner): InflightTask<Owner>[] {
    const drained: InflightTask<Owner>[] = []
    for (const [id, entry] of this.tasks) {
      if (entry.owner !== owner) continue
      this.tasks.delete(id)
      drained.push(entry)
    }
    return drained
  }
}

const describeSingleError = (err: unknown): string => {
  if (!err || typeof err !== 'object') return String(err)
  const candidate = err as {
    code?: unknown
    stack?: unknown
    message?: unknown
  }
  const code = typeof candidate.code === 'string' ? `[${candidate.code}] ` : ''
  const body =
    typeof candidate.stack === 'string' && candidate.stack.length > 0
      ? candidate.stack
      : String(candidate.message ?? err)
  return `${code}${body}`
}

export const describeWorkerError = (err: unknown): string => {
  if (err == null) return String(err)
  const parts: string[] = []
  let current: unknown = err
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current != null; depth++) {
    parts.push(describeSingleError(current))
    current =
      typeof current === 'object'
        ? (current as { cause?: unknown }).cause
        : undefined
  }
  const flattened = parts.join(' <- caused by: ').replace(/\s*\n\s*/g, ' | ')
  return flattened.length > MAX_DETAIL_LENGTH
    ? `${flattened.slice(0, MAX_DETAIL_LENGTH)}...`
    : flattened
}
