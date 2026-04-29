import { useState } from 'react'
import { useParams } from 'react-router-dom'
import MarkdownRenderer from '../components/MarkdownRenderer'
import LanguageTabs from '../components/LanguageTabs'
import CodeBlock from '../components/CodeBlock'
import TableOfContents from '../components/TableOfContents'

import {
  androidSetup, androidQuickstart,
  androidDoTransaction, androidTestPrint, androidErrorHandling, androidListener
} from '../content/languages/android'
import {
  iosSetup, iosQuickstart,
  iosDoTransaction, iosTestPrint, iosErrorHandling, iosListener
} from '../content/languages/ios'
import {
  pythonSetup, pythonQuickstart,
  pythonDoTransaction, pythonTestPrint, pythonErrorHandling, pythonListener
} from '../content/languages/python'
import {
  nodejsSetup, nodejsQuickstart,
  nodejsDoTransaction, nodejsTestPrint, nodejsErrorHandling, nodejsListener
} from '../content/languages/nodejs'
import {
  cSetup, cQuickstart,
  cDoTransaction, cTestPrint, cErrorHandling, cListener
} from '../content/languages/c'

interface LangConfig {
  label: string
  isPreview: boolean
  codeLanguage: string
  setup: string
  quickstart: string
  examples: {
    doTransaction: string
    testPrint: string
    errorHandling: string
    listener: string
  }
}

const langConfigs: Record<string, LangConfig> = {
  android: {
    label: 'Android (Kotlin)',
    isPreview: false,
    codeLanguage: 'kotlin',
    setup: androidSetup,
    quickstart: androidQuickstart,
    examples: {
      doTransaction: androidDoTransaction,
      testPrint: androidTestPrint,
      errorHandling: androidErrorHandling,
      listener: androidListener,
    },
  },
  ios: {
    label: 'iOS (Swift)',
    isPreview: true,
    codeLanguage: 'swift',
    setup: iosSetup,
    quickstart: iosQuickstart,
    examples: {
      doTransaction: iosDoTransaction,
      testPrint: iosTestPrint,
      errorHandling: iosErrorHandling,
      listener: iosListener,
    },
  },
  python: {
    label: 'Python',
    isPreview: true,
    codeLanguage: 'python',
    setup: pythonSetup,
    quickstart: pythonQuickstart,
    examples: {
      doTransaction: pythonDoTransaction,
      testPrint: pythonTestPrint,
      errorHandling: pythonErrorHandling,
      listener: pythonListener,
    },
  },
  nodejs: {
    label: 'Node.js (TypeScript)',
    isPreview: true,
    codeLanguage: 'typescript',
    setup: nodejsSetup,
    quickstart: nodejsQuickstart,
    examples: {
      doTransaction: nodejsDoTransaction,
      testPrint: nodejsTestPrint,
      errorHandling: nodejsErrorHandling,
      listener: nodejsListener,
    },
  },
  c: {
    label: 'C / C++',
    isPreview: true,
    codeLanguage: 'c',
    setup: cSetup,
    quickstart: cQuickstart,
    examples: {
      doTransaction: cDoTransaction,
      testPrint: cTestPrint,
      errorHandling: cErrorHandling,
      listener: cListener,
    },
  },
}

const mainTabs = [
  { id: 'setup', label: 'Setup' },
  { id: 'quickstart', label: 'Quickstart' },
  { id: 'examples', label: 'Examples' },
]

const exampleTabs = [
  { id: 'doTransaction', label: 'Do Transaction' },
  { id: 'testPrint', label: 'Test Print' },
  { id: 'errorHandling', label: 'Error Handling' },
  { id: 'listener', label: 'Listener' },
]

export default function LanguagePage() {
  const { lang } = useParams<{ lang: string }>()
  const [activeTab, setActiveTab] = useState('setup')
  const [activeExample, setActiveExample] = useState('doTransaction')

  const config = lang ? langConfigs[lang] : undefined

  if (!config) {
    return (
      <div className="px-8 py-10">
        <h1 className="text-2xl font-bold text-stripe-text">Language not found</h1>
      </div>
    )
  }

  const getMarkdownContent = () => {
    if (activeTab === 'setup') return config.setup
    if (activeTab === 'quickstart') return config.quickstart
    return ''
  }

  const getExampleCode = () =>
    config.examples[activeExample as keyof typeof config.examples] || ''

  const mdContent = getMarkdownContent()

  return (
    <div className="flex max-w-6xl mx-auto">
      <main className="flex-1 min-w-0 px-8 lg:px-10 py-10 max-w-3xl">

        {/* Page header */}
        <div className="mb-8 pb-6 border-b border-stripe-border">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[1.875rem] font-bold text-stripe-text leading-tight">
              {config.label}
            </h1>
            {config.isPreview && (
              <span className="text-2xs px-2 py-0.5 rounded font-semibold bg-stripe-orange-bg text-stripe-orange">
                Preview
              </span>
            )}
            {!config.isPreview && (
              <span className="text-2xs px-2 py-0.5 rounded font-semibold bg-stripe-green-bg text-stripe-green">
                Shipping
              </span>
            )}
          </div>
          <p className="text-stripe-muted text-sm">
            {config.isPreview
              ? 'This SDK binding is in Preview — full release planned for Phase 7.'
              : 'Generally available. App-to-App transport is production-ready.'}
          </p>
        </div>

        {/* Preview banner */}
        {config.isPreview && (
          <div
            className="flex items-start gap-3 px-4 py-3 rounded-stripe mb-6 text-sm"
            style={{ background: '#fef9da', border: '1px solid #fcd579' }}
          >
            <span className="text-base flex-shrink-0">⚠️</span>
            <p style={{ color: '#c84801' }}>
              <strong>v1 status: Preview.</strong> The API surface is locked but the SDK artifact ships in Phase 7.
              Do not use in production until GA.
            </p>
          </div>
        )}

        {/* Primary tabs */}
        <div className="mb-6">
          <LanguageTabs tabs={mainTabs} activeTab={activeTab} onTabChange={(t) => { setActiveTab(t); setActiveExample('doTransaction') }} />
        </div>

        {/* Content */}
        {activeTab !== 'examples' ? (
          <MarkdownRenderer content={mdContent} />
        ) : (
          <div>
            <LanguageTabs
              tabs={exampleTabs}
              activeTab={activeExample}
              onTabChange={setActiveExample}
              variant="secondary"
            />
            <CodeBlock
              code={getExampleCode()}
              language={config.codeLanguage}
              filename={`${activeExample}.${config.codeLanguage === 'kotlin' ? 'kt' : config.codeLanguage === 'swift' ? 'swift' : config.codeLanguage === 'typescript' ? 'ts' : config.codeLanguage}`}
            />
          </div>
        )}
      </main>

      {/* TOC */}
      {activeTab !== 'examples' && (
        <div className="hidden xl:block px-6 py-10 flex-shrink-0" style={{ width: 'calc(var(--toc-width) + 24px)' }}>
          <TableOfContents markdown={mdContent} />
        </div>
      )}
    </div>
  )
}
