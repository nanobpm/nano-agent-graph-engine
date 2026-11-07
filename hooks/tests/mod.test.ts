import { expect, mock, test } from 'claude-code/testing'

const STATE = {
  flows: [{ id: 'release-notes', description: 'Draft release notes' }],
  instances: [{ key: '7', flowId: 'release-notes', title: 'v2', state: 'Active', completed: false, activeElements: ['review'] }],
  userTasks: [{ key: '9', instanceKey: '7', flowId: 'release-notes', elementId: 'review', form: { title: 'Approve notes', fields: { ok: { type: 'boolean', title: 'OK?' }, note: { type: 'string' } }, required: ['ok'] } }],
  sessionJobs: [{ key: '11', jobType: 'claude' }, { key: '12', jobType: 'claude' }],
  incidents: [],
  problems: [],
}

function engine(on: any, calls: any[]) {
  mock.clock(on)
  mock.env(on, { HOME: '/home/u' })
  on('fs.exists', ($: any, e: any) => ({ value: e.path.endsWith('/work/flows') }))
  on('fs.read', () => ({ value: JSON.stringify({ url: 'http://127.0.0.1:5555', pid: 1 }) }))
  on('http.fetch', ($: any, e: any) => {
    calls.push({ url: e.url, init: e.init })
    if (e.url.endsWith('/api/state')) return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(STATE) } }
    if (e.url.endsWith('/api/start')) return { value: { status: 200, ok: true, headers: {}, text: '{"instanceKey":"8"}' } }
    return { value: { status: 200, ok: true, headers: {}, text: '{"ok":true}' } }
  })
  on('command.register', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', () => ({ cwd: '/work' }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['claude'] }))
}

const PANE = { plugin: 'agent-graph-engine', component: 'Pane', requestId: 'agent-graph', surface: 'terminal', viewport: { columns: 120, rows: 40 }, props: { title: 'Agent Graph', isFocused: true, bodyColumns: 60, placement: 'inline', scroll: { offset: 0, bodyRows: 30 }, view: {} } } as const
const BAND = { plugin: 'agent-graph-engine', component: 'AbovePrompt', requestId: 'band', surface: 'terminal', viewport: { columns: 120, rows: 40 }, props: { hasSurvey: false, isWorking: false, maxRows: 5, bodyColumns: 100, scroll: { offset: 0, bodyRows: 5 }, view: {} } } as const

test('band summarizes; session jobs wake the agent once', async ($, on) => {
  const calls: any[] = []
  const prompts: string[] = []
  engine(on, calls)
  on('prompt.submit', ($: any, e: any) => (prompts.push(e.text), { text: e.text }))
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const band = await $.ui.mount(BAND)
  expect(await band.find({ type: 'Text', text: /1 flow running · 1 task waiting for you/ })).toBeDefined()
  expect(prompts.length).toBe(1)
  expect(prompts[0]).toMatch(/2 agent steps[\s\S]*session_job_next with max 2/)
  await $.command.run({ command: 'flows', args: '' })
  expect(prompts.length).toBe(1) // same jobs: not again
})

test('pane: start a flow with JSON inputs; answer a task', async ($, on) => {
  const calls: any[] = []
  engine(on, calls)
  on('prompt.submit', ($: any, e: any) => ({ text: e.text }))
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const ui = await $.ui.mount(PANE)
  // inbox: answer
  await ui.select({ key: 'f-9-ok', value: 'true' })
  await ui.input({ key: 'f-9-note', text: 'ship it' })
  await ui.press({ key: 'submit-9' })
  const done = calls.find((c) => c.url.endsWith('/api/user-tasks/9/complete'))
  expect(JSON.parse(done.init.body)).toEqual({ variables: { ok: true, note: 'ship it' } })
  // flows: start
  await ui.press({ key: 'tab-flows' })
  await ui.press({ key: 'start-release-notes' })
  await ui.input({ key: 'inputs-release-notes', text: '{"since":"v1.0"}' })
  const st = calls.find((c) => c.url.endsWith('/api/start'))
  expect(JSON.parse(st.init.body)).toEqual({ flowId: 'release-notes', variables: { since: 'v1.0' } })
  await ui.unmount()
})

test('no engine: the pane offers to start it', async ($, on) => {
  const argv: string[][] = []
  mock.clock(on)
  mock.env(on, { HOME: '/home/u' })
  on('fs.exists', ($: any, e: any) => ({ value: e.path.endsWith('/work/flows') }))
  on('fs.read', () => ({ deny: 'ENOENT' }))
  on('process.run', ($: any, e: any) => (argv.push(e.argv), { value: { exitCode: 0, stdout: '', stderr: '' } }))
  on('command.register', () => ({ value: undefined }))
  on('session.start', () => ({ cwd: '/work' }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['claude'] }))
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /not running for \/work/ })).toBeDefined()
  await ui.press({ key: 'start-engine' })
  expect(argv[0].slice(2)).toEqual(['up', '--project', '/work'])
  expect(argv[0][1]).toMatch(/\/dist\/cli\.js$/)
  expect(argv[0][1]).not.toMatch(/undefined/)
})
