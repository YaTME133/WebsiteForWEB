export default function Footer({ overlay = false }) {
  if (overlay) {
    return (
      <footer className="fixed bottom-2 left-0 right-0 z-10 text-center text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 opacity-90">
        © 2025 ZPR Test | Проект студентов ИМ-32
      </footer>
    )
  }
  return (
    <footer className="mt-auto border-t border-transparent py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
      © 2025 ZPR Test | Проект студентов ИМ-32
    </footer>
  )
}
