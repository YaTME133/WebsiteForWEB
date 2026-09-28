import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api.js'

export default function TopicPage() {
  const { id } = useParams()
  const [topic, setTopic] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true); setError('')
      try {
        const resp = await api.get(`/topics/${id}`)
        if (!mounted) return
        setTopic(resp?.topic || null)
      } catch (e) {
        if (!mounted) return
        setError(e.message || 'Не удалось загрузить тему')
      } finally { if (mounted) setLoading(false) }
    }
    load()
    return () => { mounted = false }
  }, [id])

  if (loading) return <div className="text-zinc-500 dark:text-zinc-400">Загрузка…</div>
  if (error) return <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
  if (!topic) return <div className="text-zinc-500">Тема не найдена</div>

  return (
    <section className="mx-auto max-w-6xl px-6 py-8">
      <div className="rounded-2xl border border-violet-400/40 bg-violet-600/10 px-4 py-3 dark:border-violet-500/30 dark:bg-violet-600/15">
        <h1 className="text-2xl font-semibold text-violet-700 dark:text-violet-300">{topic.name}</h1>
  {topic.description && <div className="text-sm text-zinc-700 dark:text-zinc-300 mt-1 whitespace-pre-wrap font-mono">{topic.description}</div>}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
        {(topic.tasks || []).map((t) => (
          <div key={t.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900/60 transition-colors flex flex-col min-h-56">
            <h3 className="text-base font-semibold text-violet-700 dark:text-violet-300">{t.title}</h3>
            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-mono">{t.description}</p>
            <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Сложность: {{ easy: 'Лёгкое', medium: 'Среднее', hard: 'Сложное' }[t.difficulty] || t.difficulty} • Баллы: {t.points ?? 0}</div>
            <Link
              className="mt-auto inline-flex w-fit items-center gap-1 rounded-full border border-violet-300/60 px-3 py-1.5 text-sm text-violet-700 transition-colors hover:border-violet-400 hover:bg-violet-50 dark:border-violet-400/40 dark:text-violet-300 dark:hover:bg-violet-400/10"
              to={`/task/${t.id}`}
            >
              Открыть →
            </Link>
          </div>
        ))}
        {(topic.tasks || []).length === 0 && (
          <div className="text-zinc-400">Пока задач нет.</div>
        )}
      </div>
    </section>
  )
}
