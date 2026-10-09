import { describe, expect, it } from 'vitest'
import { BREAKING_LABEL, TYPE_LABELS, planLabels, run } from '../scripts/pr-labels.mjs'

const names = (labels: { name: string }[]): string[] => labels.map((l) => l.name)

describe('planLabels', () => {
  it('picks the label for the title type', () => {
    expect(names(planLabels('🐛 fix(shelf): keep focus', []).add)).toEqual(['bug'])
    expect(names(planLabels('✨ feat: add pinboards', []).add)).toEqual(['enhancement'])
    expect(names(planLabels('👷 ci: label pull requests', []).add)).toEqual(['ci'])
  })

  it('adds a breaking change label for "!"', () => {
    expect(names(planLabels('💥 feat(api)!: rename channels', []).add)).toEqual([
      'enhancement',
      'breaking change'
    ])
  })

  it('swaps labels when the type changes and keeps labels it does not manage', () => {
    expect(planLabels('✨ feat: add search', ['bug', 'good first issue'])).toEqual({
      add: [TYPE_LABELS.feat],
      remove: ['bug']
    })
  })

  it('does nothing when labels already match', () => {
    expect(planLabels('🐛 fix: keep focus', ['bug'])).toEqual({ add: [], remove: [] })
  })

  it('removes type labels when the title no longer follows the format', () => {
    expect(planLabels('fix stuff', ['bug', 'help wanted'])).toEqual({ add: [], remove: ['bug'] })
  })

  it('has a label for every type the title check accepts', async () => {
    const { TYPES } = await import('../scripts/check-pr-title.mjs')
    expect(Object.keys(TYPE_LABELS).sort()).toEqual([...TYPES].sort())
    expect(BREAKING_LABEL.name).toBe('breaking change')
  })
})

interface Call {
  method: string
  path: string
  body?: unknown
}

function fakeGitHub(options: { existingLabels?: string[]; assignable?: boolean } = {}) {
  const calls: Call[] = []
  const existing = new Set(options.existingLabels ?? [])
  const request = async (method: string, path: string, body?: unknown) => {
    calls.push({ method, path, body })
    if (method === 'POST' && path.endsWith('/labels') && !path.includes('/issues/')) {
      const { name } = body as { name: string }
      if (existing.has(name)) return { status: 422, data: {} }
      existing.add(name)
      return { status: 201, data: body }
    }
    if (method === 'POST' && path.endsWith('/assignees')) {
      const { assignees } = body as { assignees: string[] }
      const added = options.assignable === false ? [] : assignees.map((login) => ({ login }))
      return { status: 201, data: { assignees: added } }
    }
    return { status: 200, data: {} }
  }
  return { calls, request }
}

const pr = (overrides: Record<string, unknown> = {}) => ({
  number: 7,
  title: '🐛 fix(shelf): keep focus',
  labels: [],
  assignees: [],
  user: { login: 'alexsilver8', type: 'User' },
  ...overrides
})

describe('run', () => {
  const repo = 'alexsilver8/openpaste'
  const quiet = () => {}

  it('labels and assigns a new pull request', async () => {
    const gh = fakeGitHub({ existingLabels: ['bug'] })
    await run({
      event: { action: 'opened', pull_request: pr() },
      repo,
      request: gh.request,
      log: quiet
    })
    expect(gh.calls).toEqual([
      { method: 'POST', path: `/repos/${repo}/labels`, body: TYPE_LABELS.fix },
      { method: 'POST', path: `/repos/${repo}/issues/7/labels`, body: { labels: ['bug'] } },
      {
        method: 'POST',
        path: `/repos/${repo}/issues/7/assignees`,
        body: { assignees: ['alexsilver8'] }
      }
    ])
  })

  it('relabels when the title changes, without reassigning', async () => {
    const gh = fakeGitHub()
    await run({
      event: {
        action: 'edited',
        changes: { title: { from: '🐛 fix: old' } },
        pull_request: pr({ title: '✨ feat(search): filter by app', labels: [{ name: 'bug' }] })
      },
      repo,
      request: gh.request,
      log: quiet
    })
    expect(gh.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      `DELETE /repos/${repo}/issues/7/labels/bug`,
      `POST /repos/${repo}/labels`,
      `POST /repos/${repo}/issues/7/labels`
    ])
  })

  it('ignores description-only edits', async () => {
    const gh = fakeGitHub()
    await run({
      event: { action: 'edited', changes: { body: { from: '' } }, pull_request: pr() },
      repo,
      request: gh.request,
      log: quiet
    })
    expect(gh.calls).toEqual([])
  })

  it('URL-encodes label names with spaces', async () => {
    const gh = fakeGitHub()
    await run({
      event: {
        action: 'edited',
        changes: { title: { from: '💥 feat!: x' } },
        pull_request: pr({
          title: '✨ feat: x',
          labels: [{ name: 'enhancement' }, { name: 'breaking change' }]
        })
      },
      repo,
      request: gh.request,
      log: quiet
    })
    expect(gh.calls).toEqual([
      {
        method: 'DELETE',
        path: `/repos/${repo}/issues/7/labels/breaking%20change`,
        body: undefined
      }
    ])
  })

  it('skips bots and pull requests that already have an assignee', async () => {
    for (const overrides of [
      { user: { login: 'dependabot[bot]', type: 'Bot' } },
      { assignees: [{ login: 'someone' }] }
    ]) {
      const gh = fakeGitHub({ existingLabels: ['bug'] })
      await run({
        event: { action: 'opened', pull_request: pr(overrides) },
        repo,
        request: gh.request,
        log: quiet
      })
      expect(gh.calls.some((c) => c.path.endsWith('/assignees'))).toBe(false)
    }
  })

  it('reports, without failing, when GitHub will not assign the author', async () => {
    const gh = fakeGitHub({ existingLabels: ['bug'], assignable: false })
    const lines: string[] = []
    await run({
      event: { action: 'opened', pull_request: pr() },
      repo,
      request: gh.request,
      log: (l) => lines.push(l)
    })
    expect(lines.at(-1)).toContain("Couldn't assign alexsilver8")
  })

  it('fails loudly on API errors', async () => {
    const request = async () => ({ status: 403, data: { message: 'Resource not accessible' } })
    await expect(
      run({ event: { action: 'opened', pull_request: pr() }, repo, request, log: quiet })
    ).rejects.toThrow('403')
  })
})
