import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Mặc định findBy/waitFor chờ 1s — không đủ cho test tương tác (modal, menu) khi CI/máy đang tải nặng.
configure({ asyncUtilTimeout: 3000 })

afterEach(() => {
  cleanup()
})

// jsdom thiếu một số API mà Mantine dùng.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverMock

window.HTMLElement.prototype.scrollIntoView = () => {}
