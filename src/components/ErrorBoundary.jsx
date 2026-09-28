import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidUpdate(prevProps) {
    // Reset boundary when resetKey changes (e.g., route change)
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ hasError: false, error: null })
    }
  }
  componentDidCatch(error, info) { console.error('ErrorBoundary caught:', error, info) }
  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-2xl p-6">
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">
            <h2 className="text-lg font-semibold">Что‑то пошло не так</h2>
            <p className="mt-1 text-sm opacity-90">Страница не смогла отобразиться. Обновите её или вернитесь назад.</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
