import { useState } from 'react'
import AdminTabs from '../components/AdminTabs.jsx'
import UsersList from '../components/UsersList.jsx'
import TasksAdmin from '../components/TasksAdmin.jsx'
import SubmissionsList from '../components/SubmissionsList.jsx'
import HistoryList from '../components/HistoryList.jsx'
import { AnimatePresence, motion } from 'framer-motion'

export default function Admin() {
  const [tab, setTab] = useState('users')
  const tabs = [
    { key: 'users', label: 'Список пользователей', node: <UsersList /> },
    { key: 'tasks', label: 'Задачи', node: <TasksAdmin /> },
    { key: 'subs', label: 'Решения учеников', node: <SubmissionsList /> },
    { key: 'history', label: 'История ответов', node: <HistoryList /> }
  ]

  return (
    <section className="mx-auto max-w-6xl px-6 py-8">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900/60">
        <h1 className="text-2xl font-semibold">Админ-панель</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-300">Управляйте пользователями, заданиями и решениями на одной странице.</p>
        <div className="mt-4">
          <AdminTabs tabs={tabs} current={tab} onChange={setTab} />
          <div className="min-h-[40vh]">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {tabs.find(t => t.key === tab)?.node}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
