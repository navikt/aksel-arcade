/**
 * Mock localStorage for testing
 * Provides a clean in-memory implementation that mimics browser localStorage
 */

export class MockLocalStorage implements Storage {
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
    
    if (totalSize > 10 * 1024 * 1024) { // 10MB simulated limit
      throw new DOMException('QuotaExceededError', 'QuotaExceededError')
    }

    this.store.set(key, value)
  }

  // Helper for testing
  _getStore(): Map<string, string> {
    return this.store
  }
}

/**
 * Setup localStorage mock for tests
 */
export const setupLocalStorageMock = (): MockLocalStorage => {
  const mockStorage = new MockLocalStorage()
  global.localStorage = mockStorage as unknown as Storage
  return mockStorage
}

/**
 * Reset localStorage mock between tests
 */
export const resetLocalStorageMock = (): void => {
  if (global.localStorage) {
    global.localStorage.clear()
  }
}
