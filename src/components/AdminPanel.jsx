import { useState } from 'react'
import Modal from './Modal.jsx'
import AdminTabs from './AdminTabs.jsx'
import UsersList from './UsersList.jsx'
import TasksAdmin from './TasksAdmin.jsx'
import SubmissionsList from './SubmissionsList.jsx'
import TopicsAdmin from './TopicsAdmin.jsx'
import HistoryList from './HistoryList.jsx'
import { motion, AnimatePresence } from 'framer-motion'

export default function AdminPanel({ open, onClose }) {
  const [tab, setTab] = useState('users')
  const tabs = [
    { key: 'users', label: 'Список пользователей', node: <UsersList /> },
    { key: 'tasks', label: 'Задачи', node: <TasksAdmin /> },
    { key: 'topics', label: 'Темы', node: <TopicsAdmin /> },
  { key: 'subs', label: 'Пакетные отправки', node: <SubmissionsList /> },
    { key: 'history', label: 'История ответов', node: <HistoryList /> }
  ]

  return (
    <Modal open={open} onClose={onClose} title="Админ-панель" mode="drawer" side="right">
      <div className="pb-2">
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
    </Modal>
  )
}
