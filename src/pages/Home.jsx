import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <section className="mx-auto max-w-6xl px-4 md:px-6 min-h-[calc(100vh-4rem)] flex flex-col overflow-hidden">{/* 4rem = h-16 of header */}
      {/* Контент по центру, минимальные интервалы между блоками */}
  <div className="flex-1 w-full flex flex-col items-center justify-start gap-2 pt-8 md:pt-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900/60 transition-colors"
        >
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-violet-700 dark:text-violet-300">
            ZPR Test — честная проверка знаний
          </h1>
          <p className="mt-3 text-base sm:text-lg text-zinc-700 dark:text-zinc-300">
            Мы, энтузиасты из группы ИМ-32, создали платформу для честной проверки знаний — без списывания и лишних лазеек.
            Здесь важен ваш собственный результат: задания, отправка решений по темам и проверка модератором.
          </p>
          <div className="mt-4">
            <Link
              to="/tasks"
              className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-5 py-2.5 text-white shadow-lg transition-colors hover:bg-violet-500"
            >
              Перейти к заданиям
            </Link>
          </div>
        </motion.div>

        {/* Блок обратной связи */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-md dark:border-zinc-800 dark:bg-zinc-900/60 transition-colors"
        >
          <h2 className="text-xl font-semibold text-violet-700 dark:text-violet-300">Для обратной связи</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li className="text-zinc-700 dark:text-zinc-300"><span className="font-medium">Email:</span> contact@example.com</li>
            <li className="text-zinc-700 dark:text-zinc-300"><span className="font-medium">Telegram:</span> @zpr_test_support</li>
            <li className="text-zinc-700 dark:text-zinc-300"><span className="font-medium">VK:</span> vk.com/zpr_test</li>
          </ul>
        </motion.div>
      </div>
    </section>
  )
}
