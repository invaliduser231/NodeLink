export interface TeardownTarget {
  resume?: () => unknown
  abort?: () => unknown
  unpipe?: () => unknown
  cleanup?: () => unknown
  removeAllListeners?: () => unknown
  on?: (event: 'error', listener: (err: unknown) => void) => unknown
  destroy?: () => unknown
}

export const ignoreLateError = (): void => {}

export const teardownPipe = (pipe: TeardownTarget): void => {
  pipe.resume?.()
  pipe.abort?.()
  pipe.unpipe?.()
  pipe.cleanup?.()
  pipe.removeAllListeners?.()
  pipe.on?.('error', ignoreLateError)
  pipe.destroy?.()
}
