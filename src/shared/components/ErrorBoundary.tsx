import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Giao diện thay thế khi vùng con bị lỗi render; `reset` để thử render lại. */
  fallback: (props: { error: unknown; reset: () => void }) => ReactNode
  onError?: (error: unknown, info: ErrorInfo) => void
}

interface ErrorBoundaryState {
  error: unknown
  hasError: boolean
}

/**
 * Cô lập lỗi render trong một vùng (vd. một widget) để không làm sập cả trang.
 * Lỗi tải dữ liệu được xử lý bằng trạng thái của query; boundary này bắt lỗi còn lại.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null, hasError: false }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error, hasError: true }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.onError?.(error, info)
  }

  reset = () => {
    this.setState({ error: null, hasError: false })
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback({ error: this.state.error, reset: this.reset })
    }
    return this.props.children
  }
}
