/**
 * Mock browser Storage for testing.
 * Provides a clean in-memory implementation that mimics localStorage/sessionStorage.
 */

export class MockBrowserStorage implements Storage {
  private store: Map<string, string> = new Map()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys())
    return keys[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    // Simulate quota exceeded error if value is too large
    const totalSize = Array.from(this.store.values())
      .concat(value)
      .reduce((sum, val) => sum + val.length, 0)

    if (totalSize > 10 * 1024 * 1024) {
      // 10MB simulated limit
      throw new DOMException('QuotaExceededError', 'QuotaExceededError')
    }

    this.store.set(key, value)
  }

  // Helper for testing
  _getStore(): Map<string, string> {
    return this.store
  }
}

export class MockLocalStorage extends MockBrowserStorage {}

export class MockSessionStorage extends MockBrowserStorage {}

/**
 * Setup localStorage mock for tests
 */
export const setupLocalStorageMock = (): MockLocalStorage => {
  const mockStorage = new MockLocalStorage()
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    configurable: true,
    writable: true,
  })
  return mockStorage
}

/**
 * Setup sessionStorage mock for tests
 */
export const setupSessionStorageMock = (): MockSessionStorage => {
  const mockStorage = new MockSessionStorage()
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: mockStorage,
    configurable: true,
    writable: true,
  })
  return mockStorage
}

/**
 * Reset localStorage mock between tests
 */
export const resetLocalStorageMock = (): void => {
  if (globalThis.localStorage) {
    globalThis.localStorage.clear()
  }
}

/**
 * Reset sessionStorage mock between tests
 */
export const resetSessionStorageMock = (): void => {
  if (globalThis.sessionStorage) {
    globalThis.sessionStorage.clear()
  }
}
