import fs from 'fs';
import path from 'path';
import { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType, TableOfContents } from 'docx';

// Enhanced Markdown to DOCX converter with title and TOC.
// Usage: node scripts/md-to-docx.mjs <input.md> <output.docx>

const [,, inputPathArg, outputPathArg] = process.argv;
if (!inputPathArg) {
  console.error('Укажите путь к Markdown: node scripts/md-to-docx.mjs <input.md> <output.docx?>');
  process.exit(1);
}

const inputPath = path.resolve(inputPathArg);
const outputPath = path.resolve(outputPathArg || path.join(path.dirname(inputPath), path.basename(inputPath, path.extname(inputPath)) + '.docx'));

const md = fs.readFileSync(inputPath, 'utf-8');

function parseMarkdown(mdText) {
  const lines = mdText.split(/\r?\n/);
  const paragraphs = [];
  let inCode = false;

  for (const line of lines) {
    if (/^```/.test(line)) {
      inCode = !inCode;
      continue;
    }
    if (line.trim().length === 0 && !inCode) {
      paragraphs.push(new Paragraph(''));
      continue;
    }
    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m && !inCode) {
      const level = m[1].length;
      const text = m[2];
      const headingLevel = [HeadingLevel.TITLE, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6][level];
      paragraphs.push(
        new Paragraph({
          heading: headingLevel,
          children: [
            new TextRun({ text, size: 28, font: 'Times New Roman', bold: level <= 2 }),
          ],
        })
      );
      continue;
    }
    if (/^[-*]\s+/.test(line) && !inCode) {
      const text = line.replace(/^[-*]\s+/, '');
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text, size: 24, font: 'Times New Roman' })],
        })
      );
      continue;
    }
    // Default paragraph (code or text)
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: line, size: 24, font: 'Times New Roman' })],
        spacing: { after: 120 },
      })
    );
  }
  return paragraphs;
}

const paragraphs = parseMarkdown(md);

function createProjectStructureParagraphs() {
  const lines = [
    'project/',
    ' ├─ index.html                                  # Корневой HTML-шаблон',
    ' ├─ package.json                                # Зависимости и скрипты',
    ' ├─ postcss.config.js                           # Конфигурация PostCSS',
    ' ├─ tailwind.config.js                          # Конфигурация TailwindCSS',
    ' ├─ vite.config.js                              # Конфигурация Vite',
    ' ├─ docs/                                       # Документация проекта',
    ' │  └─ Методические указания по вашему сайту.md',
    ' ├─ public/                                     # Статика (изображения и т.п.)',
    ' │  └─ assets/',
    ' ├─ scripts/                                    # Вспомогательные скрипты',
    ' │  └─ md-to-docx.mjs',
    ' ├─ server/                                     # Сервер и API',
    ' │  ├─ auth.js                                  # Аутентификация и роли',
    ' │  ├─ db.js                                    # Подключение и доступ к БД',
    ' │  ├─ seed.js                                  # Сиды для тестовых данных',
    ' │  └─ server.js                                # Точка входа серверного приложения',
    ' └─ src/                                        # Клиент (React)',
    '    ├─ components/                              # Переиспользуемые UI-компоненты',
    '    │  ├─ AdminPanel.jsx',
    '    │  ├─ AdminTabs.jsx',
    '    │  ├─ AntiCheatBanner.jsx',
    '    │  ├─ DropdownMenu.jsx',
    '    │  ├─ ErrorBoundary.jsx',
    '    │  ├─ Footer.jsx',
    '    │  ├─ Header.jsx',
    '    │  ├─ HistoryList.jsx',
    '    │  ├─ Modal.jsx',
    '    │  ├─ ProgressBar.jsx',
    '    │  ├─ SubmissionsList.jsx',
    '    │  ├─ TasksAdmin.jsx',
    '    │  ├─ ThemeToggle.jsx',
    '    │  ├─ TopicsAdmin.jsx',
    '    │  └─ UsersList.jsx',
    '    ├─ hooks/                                   # Пользовательские хуки',
    '    │  └─ useAntiCheat.js',
    '    ├─ lib/                                     # Утилиты и API-клиент',
    '    │  └─ api.js',
    '    ├─ pages/                                   # Страницы приложения',
    '    │  ├─ Admin.jsx',
    '    │  ├─ Home.jsx',
    '    │  ├─ Login.jsx',
    '    │  ├─ Progress.jsx',
    '    │  ├─ Register.jsx',
    '    │  ├─ SuperAdmin.jsx',
    '    │  ├─ Task.jsx',
    '    │  ├─ Tasks.jsx',
    '    │  └─ Topic.jsx',
    '    ├─ App.jsx',
    '    ├─ auth.jsx',
    '    ├─ index.css',
    '    ├─ main.jsx',
    '    └─ theme.jsx',
  ];

  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'Структура проекта', size: 28, font: 'Times New Roman', bold: true })],
    }),
    ...lines.map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line, size: 24, font: 'Times New Roman' })],
          spacing: { after: 60 },
        })
    ),
  ];
}

const doc = new Document({
  sections: [
    {
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'Методические указания', bold: true, size: 28, font: 'Times New Roman' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'по вашему сайту', size: 24, font: 'Times New Roman' })],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: 'Оглавление', size: 28, font: 'Times New Roman', bold: true })],
        }),
        new TableOfContents('Содержание', { hyperlink: true, headingStyleRange: '1-5' }),
        new Paragraph({ text: '' }),
        ...createProjectStructureParagraphs(),
        new Paragraph({ text: '' }),
        ...paragraphs,
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outputPath, buffer);
console.log(`DOCX создан: ${outputPath}`);
