// Agent Graph mod for Claude Code: makes the flow engine part of the interface.
//  - a band above the prompt: running flows, tasks waiting for you, incidents
//  - /flows opens a pane: start a flow, answer user tasks, retry/cancel incidents
//  - "Open ↗" links go to the web explorer, at what needs you (a waiting task, the one
//    running flow, else the flows); in the Desktop app they open in its Browser pane
//  - wakes the agent when a flow hands agent steps to this session
// One engine serves every project. The mod talks to it over its local HTTP API (address
// in ~/.agent-graph/daemon.json), shows this project's flows plus the global ones, and
// all running work with other projects' marked. It never starts a model turn except to
// hand this project's session jobs to the agent.

const PANE = 'agent-graph'
const POLL_MS = 3000

let project = ''
let url = ''
let engineFile = '' // ~/.agent-graph/daemon.json (AGE_STATE_DIR)
let registered = '' // engine url this project was registered with
let state = null // last /api/state, trimmed
let error = ''
let tab = 'inbox'
let startFor = '' // flow id whose start form is open
let drafts = {} // user task key -> { field: value }
let woken = new Set() // session job keys already handed to the agent
let notified = new Set() // user task keys already toasted

const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's')

/** The project this session works on: nearest ancestor with flows/, else the git root,
 *  else the cwd — or ~/AgentGraph (the global library) in / or $HOME. */
async function findProject($, cwd) {
  const home = (await $.env.get('HOME')) || ''
  if (cwd === '/' || cwd === home) return (await $.env.get('AGE_HOME')) || home + '/AgentGraph'
  let git = ''
  for (let dir = cwd; dir && dir !== home; ) {
    if (await $.fs.exists(dir + '/flows')) return dir
    if (!git && (await $.fs.exists(dir + '/.git'))) git = dir
    const up = dir.replace(/\/[^/]+\/?$/, '') || '/'
    if (up === dir) break
    dir = up
  }
  return git || cwd
}

const base = (p) => String(p || '').split('/').filter(Boolean).pop() || p
/** " · <project>" for work that belongs to another project. */
const elsewhere = (x) => (x && x.project && x.project !== project ? ' · ' + base(x.project) : '')
// the Desktop app only links http://localhost (engines before 0.5.2 wrote 127.0.0.1)
const explorerUrl = () => url.replace('//127.0.0.1:', '//localhost:') + '/?project=' + encodeURIComponent(project)

async function api($, path, body) {
  const r = await $.http.fetch(url + path, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = r.text ? JSON.parse(r.text) : {}
  if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status)
  return data
}

async function refresh($) {
  if (!project) return
  let info
  try {
    info = JSON.parse(await $.fs.read(engineFile))
  } catch {
    url = ''
    state = null
    $.ui.invalidate('ui.render')
    return
  }
  url = info.url
  try {
    // A project with flows/ joins the engine as soon as the engine is up.
    if (registered !== url && (await $.fs.exists(project + '/flows'))) {
      await api($, '/api/projects', { path: project })
      registered = url
    }
    const s = await api($, '/api/state?project=' + encodeURIComponent(project))
    state = {
      flows: s.flows || [],
      globalDir: s.globalDir || '',
      instances: (s.instances || []).filter((i) => !i.completed),
      userTasks: s.userTasks || [],
      // agent steps for this session: only runs in this project
      sessionJobs: (s.sessionJobs || []).filter((j) => j.state === 'Created' && (!j.project || j.project === project)),
      incidents: (s.incidents || []).filter((i) => i.state !== 'Resolved'),
      problems: s.problems || [],
    }
    error = ''
  } catch (e) {
    state = null
    url = ''
    error = String((e && e.message) || e)
  }
  await announce($)
  $.ui.invalidate('ui.render')
}

/** Toast new user tasks; hand new session jobs to the agent. */
async function announce($) {
  if (!state) return
  for (const t of state.userTasks) {
    if (notified.has(t.key)) continue
    notified.add(t.key)
    $.ui.toast('Flow ' + (t.title || t.flowId) + elsewhere(t) + ' is waiting for you: ' + ((t.form && t.form.title) || t.elementId) + ' — /flows')
  }
  const fresh = state.sessionJobs.filter((j) => !woken.has(j.key))
  if (!fresh.length) return
  for (const j of fresh) woken.add(j.key)
  // don't await: submit waits for the session to be idle
  $.prompt.submit({
    text:
      'Agent Graph: ' + plural(fresh.length, 'agent step') + ' from running flows are waiting for this session. ' +
      'Call session_job_next' + (fresh.length > 1 ? ' with max ' + fresh.length + ' (use subagents for them if you can)' : '') +
      ', do the work, and hand back each result with session_job_complete.',
  })
}

async function startEngine($) {
  try {
    const r = await $.process.run(['node', $.plugin.root + '/dist/cli.js', 'up', '--project', project], { timeoutMs: 20000 })
    if (r.exitCode !== 0) error = (r.stderr || r.stdout || 'engine did not start').trim()
  } catch (e) {
    error = String((e && e.message) || e)
  }
  await refresh($)
}

/** Opens the web explorer in the browser via `age open`, which starts the engine if
 *  needed. `view` is an explorer route: instance=K, task=K, flow=ID, or empty. */
async function openExplorer($, view) {
  try {
    const argv = ['node', $.plugin.root + '/dist/cli.js', 'open', ...(view ? [view] : []), '--project', project]
    const r = await $.process.run(argv, { timeoutMs: 20000 })
    if (r.exitCode !== 0) throw new Error((r.stderr || r.stdout || 'could not open the explorer').trim())
    await $.ui.toast('Opened the Agent Graph explorer: ' + r.stdout.trim())
  } catch (e) {
    await $.ui.toast('Agent Graph: ' + String((e && e.message) || e))
  }
  await refresh($)
}

/** The explorer view that needs you: a task waiting in this project, else this project's
 *  only running flow, else the flows. */
function bestView() {
  if (!state) return ''
  const here = (x) => !x.project || x.project === project
  const task = state.userTasks.find(here) || state.userTasks[0]
  if (task) return 'task=' + task.key
  const incident = state.incidents.find(here)
  if (incident) return 'instance=' + incident.instanceKey
  const runs = state.instances.filter(here)
  if (runs.length === 1) return 'instance=' + runs[0].key
  return runs.length ? '/instances' : '/flows'
}

/** A way to open an explorer view. The terminal gets a button that opens the default
 *  browser (it can start the engine); the Desktop app and VS Code get a Link, which the
 *  Desktop app opens in its Browser pane. */
function openControl($, e, ui, key, label, view, hotkey) {
  if (e.surface === 'terminal' || !url) return ui.Button({ key, label, hotkey, plain: true, onPress: () => openExplorer($, view) })
  return ui.Link({ href: explorerUrl() + (view ? '#' + view.replace(/^#/, '') : ''), label })
}

async function startFlow($, flowId, input) {
  const text = (input || '').trim()
  let variables
  if (!text) variables = {}
  else {
    try {
      variables = JSON.parse(text)
    } catch {
      variables = undefined
    }
  }
  startFor = ''
  if (variables && typeof variables === 'object' && !Array.isArray(variables)) {
    try {
      const r = await api($, '/api/start', { flowId, variables, project, host: 'claude-code' })
      $.ui.toast('Started ' + flowId + ' #' + r.instanceKey)
    } catch (e) {
      $.ui.toast('Could not start ' + flowId + ': ' + ((e && e.message) || e))
    }
    await refresh($)
    return
  }
  // plain words: let the agent work out the start variables
  $.prompt.submit({ text: 'Start the Agent Graph flow "' + flowId + '" for: ' + text + '. Work out its start variables (flow_read if unsure), then flow_start.', asUser: true })
}

async function completeTask($, task) {
  const vars = { ...defaults(task), ...(drafts[task.key] || {}) }
  const missing = ((task.form && task.form.required) || []).filter((k) => vars[k] === undefined || vars[k] === '')
  if (missing.length) {
    $.ui.toast('Fill in: ' + missing.join(', '))
    return
  }
  try {
    await api($, '/api/user-tasks/' + task.key + '/complete', { variables: vars })
    delete drafts[task.key]
    $.ui.toast('Answered ' + ((task.form && task.form.title) || task.elementId))
  } catch (e) {
    $.ui.toast('Could not complete the task: ' + ((e && e.message) || e))
  }
  await refresh($)
}

function defaults(task) {
  const out = {}
  const fields = (task.form && task.form.fields) || {}
  for (const k of Object.keys(fields)) if (fields[k].default !== undefined) out[k] = fields[k].default
  return out
}

function coerce(field, v) {
  if (field.type === 'number' || field.type === 'integer') return v === '' ? undefined : Number(v)
  if (field.type === 'boolean') return v === 'true'
  return v
}

async function resolveIncident($, inc) {
  try {
    await api($, '/api/incidents/' + inc.key + '/resolve', { retries: 1 })
    $.ui.toast('Retrying ' + inc.elementId)
  } catch (e) {
    $.ui.toast('Retry failed: ' + ((e && e.message) || e))
  }
  await refresh($)
}

async function cancelInstance($, key) {
  try {
    await api($, '/api/instances/' + key + '/cancel', {})
    $.ui.toast('Cancelled #' + key)
  } catch (e) {
    $.ui.toast('Cancel failed: ' + ((e && e.message) || e))
  }
  await refresh($)
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    // Register before next(): the Desktop app and VS Code take their / menu from what is
    // registered when the session starts.
    try {
      await $.command.register({ name: 'flows', description: 'Agent Graph: start flows, answer tasks, handle incidents', argumentHint: '[flows | runs]', immediate: true })
    } catch (err) {
      error = String((err && err.message) || err)
    }
    const r = await next(e)
    project = await findProject($, (r && r.cwd) || e.cwd || (await $.session.cwd()))
    engineFile = ((await $.env.get('AGE_STATE_DIR')) || ((await $.env.get('HOME')) || '') + '/.agent-graph') + '/daemon.json'
    await refresh($)
    $.clock.every(POLL_MS, () => refresh($))
    return r
  })

  on('command.run', { command: 'flows' }, async ($, e) => {
    await refresh($)
    const arg = (e.args || '').trim()
    if (arg === 'start' || arg === 'flows') tab = 'flows'
    else if (arg === 'runs') tab = 'runs'
    else if (state && !state.userTasks.length && !state.incidents.length) tab = 'flows'
    await $.ui.open({ id: PANE, title: 'Agent Graph', focus: true, closeOnEscape: true })
    return {}
  })

  // the band above the prompt: only while something is going on
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!state) return next(e)
    const tasks = state.userTasks.length
    const incidents = state.incidents.length
    const running = state.instances.length
    if (!tasks && !incidents && !running) return next(e)
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const away = state.instances.filter((i) => elsewhere(i)).length
    const parts = [plural(running, 'flow') + ' running' + (away ? ' (' + away + ' in other projects)' : '')]
    if (tasks) parts.push(plural(tasks, 'task') + ' waiting for you')
    if (incidents) parts.push(plural(incidents, 'incident'))
    const mine = Box({
      flexDirection: 'row',
      columnGap: 2,
      children: [
        Text({ color: incidents ? 'red' : tasks ? 'yellow' : undefined, children: ['⚙ Agent Graph · ' + parts.join(' · ')] }),
        Button({
          key: 'open-flows',
          label: tasks ? 'Answer' : 'Open',
          plain: true,
          onPress: async () => {
            tab = tasks || incidents ? 'inbox' : 'runs'
            await $.ui.open({ id: PANE, title: 'Agent Graph', focus: true, closeOnEscape: true })
          },
        }),
        openControl($, e, ui, 'band-explorer', 'Open ↗', bestView()),
      ],
    })
    const theirs = await next(e)
    return theirs ? Box({ flexDirection: 'column', children: [mine, theirs] }) : mine
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const ui = $.ui.resolve(e)
    const { Box, Text, Button, Input, Select } = ui
    const redraw = () => $.ui.invalidate('ui.render')
    const width = (e.props && e.props.bodyColumns) || 60
    const dim = (s) => Text({ dimColor: true, children: [s] })

    if (!state) {
      return Box({
        flexDirection: 'column',
        rowGap: 1,
        children: [
          Text({ children: ['The Agent Graph engine is not running.'] }),
          error ? Text({ color: 'red', children: [error] }) : dim('It starts with the first flow tool call, or here.'),
          Button({ key: 'start-engine', label: 'Start engine', hotkey: 's', variant: 'primary', onPress: () => startEngine($) }),
        ],
      })
    }

    const tabButton = (name, label, hotkey) =>
      Button({ key: 'tab-' + name, label, hotkey, plain: true, dimColor: tab !== name, onPress: () => ((tab = name), redraw()) })
    const header = Box({
      flexDirection: 'row',
      columnGap: 3,
      children: [
        tabButton('inbox', 'Inbox (' + (state.userTasks.length + state.incidents.length) + ')', '1'),
        tabButton('flows', 'Flows (' + state.flows.length + ')', '2'),
        tabButton('runs', 'Runs (' + state.instances.length + ')', '3'),
        openControl($, e, ui, 'open-explorer', 'Open ↗', bestView(), 'o'),
      ],
    })

    let body = []
    if (tab === 'inbox') {
      if (!state.userTasks.length && !state.incidents.length) body.push(dim('Nothing is waiting for you.'))
      for (const t of state.userTasks) {
        const form = t.form || { fields: {} }
        const draft = drafts[t.key] || (drafts[t.key] = {})
        const rows = [
          Text({ bold: true, children: [(form.title || t.elementId) + '  '] }),
          dim((t.title || t.flowId) + ' #' + t.instanceKey + elsewhere(t)),
        ]
        if (form.description) rows.push(Text({ wrap: 'wrap', children: [String(form.description).slice(0, 4000)] }))
        for (const [name, field] of Object.entries(form.fields || {})) {
          const label = (field.title || name) + (((form.required || []).includes(name)) ? ' *' : '')
          const key = 'f-' + t.key + '-' + name
          if (field.type === 'boolean' || field.enum) {
            const options = field.type === 'boolean'
              ? [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]
              : field.enum.map((v, i) => ({ value: v, label: (field.enumNames && field.enumNames[i]) || v }))
            const cur = draft[name] !== undefined ? String(draft[name]) : field.default !== undefined ? String(field.default) : undefined
            rows.push(Select({ key, label, options, ...(cur !== undefined ? { value: cur } : {}), onSelect: (v) => ((draft[name] = coerce(field, v)), redraw()) }))
          } else {
            rows.push(
              Input({
                key,
                label,
                placeholder: field.description || '',
                value: draft[name] !== undefined ? String(draft[name]) : '',
                onInput: (v) => (draft[name] = coerce(field, v)),
                onSubmit: (v) => ((draft[name] = coerce(field, v)), redraw()),
              }),
            )
          }
        }
        rows.push(Button({ key: 'submit-' + t.key, label: 'Submit', variant: 'primary', onPress: () => completeTask($, t) }))
        body.push(Box({ flexDirection: 'column', borderStyle: 'round', paddingX: 1, children: rows }))
      }
      for (const inc of state.incidents) {
        body.push(
          Box({
            flexDirection: 'column',
            borderStyle: 'round',
            borderColor: 'red',
            paddingX: 1,
            children: [
              Text({ color: 'red', children: ['Incident in #' + inc.instanceKey + ' at ' + inc.elementId + elsewhere(inc)] }),
              Text({ wrap: 'wrap', children: [String(inc.errorMessage || inc.message || '').slice(0, 1000)] }),
              Box({
                flexDirection: 'row',
                columnGap: 2,
                children: [
                  Button({ key: 'retry-' + inc.key, label: 'Retry', onPress: () => resolveIncident($, inc) }),
                  Button({ key: 'fix-' + inc.key, label: 'Ask Claude to fix', onPress: () => $.prompt.submit({ text: 'Agent Graph incident in instance ' + inc.instanceKey + ' at ' + inc.elementId + ': ' + (inc.errorMessage || '') + '. Find the cause, fix the flow with flow_write if needed, then retry with flow_operate.', asUser: true }) }),
                  Button({ key: 'cancel-' + inc.key, label: 'Cancel run', onPress: () => cancelInstance($, inc.instanceKey) }),
                ],
              }),
            ],
          }),
        )
      }
    } else if (tab === 'flows') {
      // Project flows, then the shared library's (~/AgentGraph/flows), which run here too.
      const sections = state.globalDir && state.globalDir !== project
        ? [
            ['Project flows · ' + base(project), state.flows.filter((f) => f.scope !== 'global'), 'None in ' + project + '/flows. Ask Claude to write one, e.g. "make a flow that…".'],
            ['Global flows', state.flows.filter((f) => f.scope === 'global'), 'None in ' + String(state.globalDir) + '/flows.'],
          ]
        : [['', state.flows, 'No flows yet. Ask Claude to write one, e.g. "make a flow that…".']]
      for (const [label, list, empty] of sections) {
      if (label) body.push(Text({ bold: true, dimColor: true, children: [label + ' (' + list.length + ')'] }))
      if (!list.length) body.push(dim(empty))
      for (const f of list) {
        const row = [
          Box({
            flexDirection: 'row',
            columnGap: 2,
            children: [
              Button({ key: 'start-' + f.id, label: 'Start', onPress: () => ((startFor = startFor === f.id ? '' : f.id), redraw()) }),
              Text({ bold: true, children: [f.id] }),
            ],
          }),
        ]
        if (f.description) row.push(dim(String(f.description).slice(0, width * 2)))
        if (startFor === f.id)
          row.push(
            Input({
              key: 'inputs-' + f.id,
              label: 'Inputs',
              placeholder: 'JSON variables, or describe it in words for Claude',
              value: '',
              submitLabel: 'start',
              autoFocus: true,
              onSubmit: (v) => startFlow($, f.id, v),
            }),
          )
        body.push(Box({ flexDirection: 'column', children: row }))
      }
      }
      for (const p of state.problems.slice(0, 5)) body.push(Text({ color: 'red', children: [(p.file || '') + ': ' + (p.message || '')] }))
    } else {
      if (!state.instances.length) body.push(dim('No flows running.'))
      for (const i of state.instances) {
        body.push(
          Box({
            flexDirection: 'row',
            columnGap: 2,
            children: [
              Text({ bold: true, children: ['#' + i.key] }),
              Text({ children: [(i.title || i.flowId) + ' → ' + ((i.activeElements || []).join(', ') || i.state) + elsewhere(i)] }),
              openControl($, e, ui, 'open-run-' + i.key, '↗', 'instance=' + i.key),
              Button({ key: 'cancel-run-' + i.key, label: 'x', plain: true, onPress: () => cancelInstance($, i.key) }),
            ],
          }),
        )
      }
    }

    return Box({
      flexDirection: 'column',
      rowGap: 1,
      children: [header, ...body],
    })
  })
}
