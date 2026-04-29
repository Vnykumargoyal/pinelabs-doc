import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import CodeBlock from './CodeBlock'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[*_`[\]]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function MarkdownRenderer({ content }: { content: string }) {
  const components: Components = {
    h1: ({ children }) => (
      <h1 className="text-[1.875rem] font-bold text-stripe-text mb-5 mt-2 leading-tight tracking-tight">
        {children}
      </h1>
    ),
    h2: ({ children }) => {
      const id = slugify(String(children).replace(/[*_`]/g, ''))
      return (
        <h2
          id={id}
          className="text-xl font-semibold text-stripe-text mt-10 mb-3 pb-2.5 border-b border-stripe-border scroll-mt-topbar"
        >
          {children}
        </h2>
      )
    },
    h3: ({ children }) => {
      const id = slugify(String(children).replace(/[*_`]/g, ''))
      return (
        <h3 id={id} className="text-[1rem] font-semibold text-stripe-text mt-7 mb-2.5 scroll-mt-topbar">
          {children}
        </h3>
      )
    },
    h4: ({ children }) => (
      <h4 className="text-sm font-semibold text-stripe-text mt-5 mb-2 uppercase tracking-wide">
        {children}
      </h4>
    ),
    p: ({ children }) => (
      <p className="text-stripe-muted mb-4 leading-relaxed">{children}</p>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-pine-500 hover:text-pine-600 hover:underline"
        target={href?.startsWith('http') ? '_blank' : undefined}
        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      >
        {children}
      </a>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-stripe-text">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    ul: ({ children }) => (
      <ul className="list-none pl-0 mb-4 space-y-1.5">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-outside pl-5 mb-4 space-y-1.5 text-stripe-muted">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="flex items-start gap-2 text-stripe-muted leading-relaxed">
        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-stripe-subtle flex-shrink-0" />
        <span>{children}</span>
      </li>
    ),
    blockquote: ({ children }) => (
      <div className="my-4 rounded-stripe overflow-hidden"
        style={{ borderLeft: '3px solid #1A56DB', background: '#eef3ff' }}>
        <div className="px-4 py-3 text-sm text-pine-700 [&>p]:mb-0 [&>p]:text-pine-700">
          {children}
        </div>
      </div>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    code: ({ inline, className, children }: any) => {
      if (inline) {
        return (
          <code
            className="text-[0.8125rem] font-mono px-1.5 py-0.5 rounded"
            style={{ background: '#f0f4ff', color: '#3451b2' }}
          >
            {children}
          </code>
        )
      }
      const match = /language-(\w+)/.exec(className || '')
      const lang = match ? match[1] : 'text'
      return <CodeBlock code={String(children).replace(/\n$/, '')} language={lang} />
    },
    pre: ({ children }) => <>{children}</>,
    table: ({ children }) => (
      <div className="overflow-x-auto my-6 rounded-stripe border border-stripe-border">
        <table className="w-full text-sm border-collapse">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead style={{ background: '#f6f8fa' }}>{children}</thead>
    ),
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => (
      <tr className="border-b border-stripe-border last:border-0 hover:bg-stripe-surface transition-colors">
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-stripe-muted border-b border-stripe-border">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2.5 text-stripe-muted align-top leading-relaxed">
        {children}
      </td>
    ),
    hr: () => <hr className="my-8 border-stripe-border" />,
  }

  return (
    <div className="prose-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
