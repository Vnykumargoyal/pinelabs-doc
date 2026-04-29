import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'

interface CodeBlockProps {
  code: string
  language?: string
  filename?: string
}

const LANG_LABELS: Record<string, string> = {
  kotlin:     'Kotlin',
  swift:      'Swift',
  python:     'Python',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  ts:         'TypeScript',
  js:         'JavaScript',
  c:          'C',
  cpp:        'C++',
  bash:       'Shell',
  shell:      'Shell',
  sh:         'Shell',
  json:       'JSON',
  xml:        'XML',
  gradle:     'Gradle (Groovy)',
  groovy:     'Gradle (Groovy)',
  proguard:   'ProGuard',
  cmake:      'CMake',
  http:       'HTTP',
  text:       'Plain Text',
  plaintext:  'Plain Text',
  csv:        'CSV',
  toml:       'TOML',
  yaml:       'YAML',
}

// Stripe / GitHub-inspired dark theme with vivid token colors
const githubDark: Record<string, React.CSSProperties> = {
  'code[class*="language-"]': {
    color: '#e6edf3',
    background: 'none',
    fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", "Source Code Pro", Menlo, Consolas, monospace',
    fontSize: '0.825rem',
    lineHeight: '1.75',
    fontVariantLigatures: 'contextual',
  },
  'pre[class*="language-"]': {
    color: '#e6edf3',
    background: '#161b22',
    fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", "Source Code Pro", Menlo, Consolas, monospace',
    fontSize: '0.825rem',
    lineHeight: '1.75',
    padding: '1.1rem 1.25rem',
    margin: '0',
    overflow: 'auto',
    borderRadius: '0',
  },
  comment:   { color: '#8b949e', fontStyle: 'italic' },
  prolog:    { color: '#8b949e' },
  doctype:   { color: '#8b949e' },
  cdata:     { color: '#8b949e' },
  punctuation:    { color: '#e6edf3' },
  property:       { color: '#79c0ff' },
  tag:            { color: '#7ee787' },
  boolean:        { color: '#79c0ff' },
  number:         { color: '#79c0ff' },
  constant:       { color: '#79c0ff' },
  symbol:         { color: '#79c0ff' },
  deleted:        { color: '#ffa198' },
  selector:       { color: '#7ee787' },
  'attr-name':    { color: '#7ee787' },
  string:         { color: '#a5d6ff' },
  char:           { color: '#a5d6ff' },
  builtin:        { color: '#ffa657' },
  inserted:       { color: '#56d364' },
  operator:       { color: '#e6edf3' },
  entity:         { color: '#e6edf3', cursor: 'help' },
  url:            { color: '#a5d6ff' },
  variable:       { color: '#ffa657' },
  atrule:         { color: '#d2a8ff' },
  'attr-value':   { color: '#a5d6ff' },
  function:       { color: '#d2a8ff' },
  'class-name':   { color: '#ffa657' },
  keyword:        { color: '#ff7b72' },
  regex:          { color: '#7ee787' },
  important:      { color: '#ff7b72', fontWeight: 'bold' },
  bold:           { fontWeight: 'bold' },
  italic:         { fontStyle: 'italic' },
}

const LANG_ICONS: Record<string, string> = {
  kotlin: '🤖', swift: '🍎', python: '🐍',
  typescript: '⬡', javascript: '⬡', ts: '⬡', js: '⬡',
  c: '⚙', cpp: '⚙', bash: '>', shell: '>', sh: '>',
  json: '{}', xml: '</>', gradle: '🐘', groovy: '🐘',
}

export default function CodeBlock({ code, language = 'text', filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const langKey = language.toLowerCase()
  const label = filename || LANG_LABELS[langKey] || language.toUpperCase()
  const icon = LANG_ICONS[langKey]
  const syntaxLang = langKey === 'text' || langKey === 'plaintext' ? 'plaintext' : langKey

  return (
    <div
      className="my-5 overflow-hidden"
      style={{
        borderRadius: '8px',
        border: '1px solid #30363d',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }}
    >
      {/* ── Header ─────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4"
        style={{
          background: '#21262d',
          borderBottom: '1px solid #30363d',
          minHeight: '38px',
        }}
      >
        {/* Left: dot indicators + language label */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f57' }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#febc2e' }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#28c840' }} />
          </div>
          <span
            className="text-xs font-medium flex items-center gap-1.5"
            style={{ color: '#8b949e', fontFamily: 'inherit' }}
          >
            {icon && <span style={{ fontSize: '11px' }}>{icon}</span>}
            {label}
          </span>
        </div>

        {/* Right: copy button */}
        <button
          onClick={copy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all"
          style={{
            color: copied ? '#56d364' : '#8b949e',
            background: copied ? 'rgba(86,211,100,0.1)' : 'transparent',
            border: `1px solid ${copied ? 'rgba(86,211,100,0.4)' : 'transparent'}`,
          }}
          onMouseEnter={e => { if (!copied) (e.currentTarget as HTMLButtonElement).style.color = '#e6edf3' }}
          onMouseLeave={e => { if (!copied) (e.currentTarget as HTMLButtonElement).style.color = '#8b949e' }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* ── Code body ──────────────────────────── */}
      <div style={{ background: '#0d1117' }}>
        <SyntaxHighlighter
          language={syntaxLang}
          style={githubDark}
          customStyle={{
            margin: 0,
            background: 'transparent',
            padding: '1.1rem 1.25rem',
          }}
          showLineNumbers={code.split('\n').length > 4}
          lineNumberStyle={{
            color: '#484f58',
            fontSize: '0.75rem',
            paddingRight: '1.25rem',
            userSelect: 'none',
            minWidth: '2.5rem',
          }}
          wrapLongLines={false}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}

