import type { ReactNode } from 'react'

/**
 * A deliberately tiny syntax tint for code cards: comments, strings, numbers and
 * keywords across the C family, Python, shell and SQL. Not a parser — just enough
 * color to tell code apart at a glance.
 */
const TOKEN = new RegExp(
  [
    String.raw`(\/\/[^\n]*|\/\*[\s\S]*?\*\/|(?<=^|\s)#[\s!][^\n]*|(?<=^|\s)--\s[^\n]*)`, // comment
    String.raw`("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|` + '`(?:\\\\.|[^`\\\\])*`)', // string
    String.raw`\b(\d+(?:\.\d+)?)\b`, // number
    String.raw`\b(function|const|let|var|return|if|else|for|while|do|switch|case|break|continue|new|class|interface|type|enum|extends|implements|import|from|export|default|async|await|yield|try|catch|finally|throw|def|elif|lambda|pass|with|as|in|is|not|and|or|None|True|False|null|undefined|true|false|this|self|public|private|protected|static|void|fn|let|mut|impl|struct|pub|use|mod|match|package|func|go|defer|select|SELECT|FROM|WHERE|JOIN|LEFT|INNER|ON|GROUP|BY|ORDER|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|AND|OR|NOT|LIMIT|sudo|echo|cd|export)\b`
  ].join('|'),
  'g'
)

export function highlightCode(source: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let key = 0
  for (const match of source.matchAll(TOKEN)) {
    const index = match.index ?? 0
    if (index > last) out.push(source.slice(last, index))
    const cls = match[1] ? 'tk-comment' : match[2] ? 'tk-string' : match[3] ? 'tk-number' : 'tk-keyword'
    out.push(
      <span key={key++} className={cls}>
        {match[0]}
      </span>
    )
    last = index + match[0].length
  }
  if (last < source.length) out.push(source.slice(last))
  return out
}

/** Wraps search matches in <mark>. */
export function highlightMatches(text: string, terms: string[]): ReactNode[] {
  const clean = terms.filter((t) => t.length > 0 && !t.includes(':'))
  if (!clean.length) return [text]
  const pattern = new RegExp(`(${clean.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return text.split(pattern).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part))
}
