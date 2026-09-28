import type { MoinApi } from '../shared/app'

declare global {
  interface Window {
    moin: MoinApi
  }
}

export {}
