window.__ModuleLoader__.load({
  id: '@local/dsh-skill-switch',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const CSS = {
      wrap: { padding: '4px 0 24px', maxWidth: 760, color: 'inherit' },
      head: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
      title: { fontSize: 16, fontWeight: 600, margin: 0 },
      summary: { fontSize: 12, opacity: 0.65 },
      hint: { fontSize: 12, opacity: 0.55, margin: '6px 0 14px' },
      error: { fontSize: 12.5, padding: '10px 12px', borderRadius: 8, background: 'rgba(220,38,38,0.10)', color: '#b91c1c', marginBottom: 12 },
      packBar: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(127,127,127,0.10)', margin: '16px 0 8px' },
      packName: { fontSize: 13, fontWeight: 600 },
      packMeta: { fontSize: 11.5, opacity: 0.6 },
      row: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(127,127,127,0.22)', marginBottom: 8 },
      name: { fontSize: 13.5, fontWeight: 600 },
      alias: { fontSize: 11.5, opacity: 0.55, marginLeft: 6 },
      desc: { fontSize: 11.5, opacity: 0.62, marginTop: 3, lineHeight: 1.45 },
      cost: { fontSize: 11, opacity: 0.5, whiteSpace: 'nowrap' },
      btn: { fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(127,127,127,0.35)', background: 'transparent', color: 'inherit', cursor: 'pointer' },
    }

    function sessionCandidates(ctx) {
      const out = []
      try {
        const s = ctx.sessions
        if (!s) return out
        const cur = s.current && s.current.value
        if (cur && (cur.key || cur.id)) out.push(cur.key || cur.id)
        const list = s.list
        if (list && typeof list.getSnapshot === 'function') {
          const snap = list.getSnapshot()
          if (snap && typeof snap.current === 'string') out.push(snap.current)
          if (snap && snap.byId) {
            const stamp = function (entry) {
              if (!entry) return 0
              return entry.updatedAt || entry.createdAt || (entry.info && entry.info.updatedAt) || 0
            }
            Object.keys(snap.byId)
              .sort(function (a, b) { return stamp(snap.byId[b]) - stamp(snap.byId[a]) })
              .forEach(function (id) { out.push(id) })
          }
        }
      } catch (err) { /* ignore */ }
      return out.filter(function (v, i, arr) { return v && arr.indexOf(v) === i })
    }

    function parseResult(res, line) {
      const value = res.value
      if (!value) throw new Error('命令未识别：' + line)
      const result = value.result
      if (result && result.kind === 'error') throw new Error(result.text || '命令返回错误')
      try {
        return JSON.parse(result.text)
      } catch (err) {
        throw new Error('返回内容不是 JSON：' + String(result && result.text).slice(0, 120))
      }
    }

    function makeApi(ctx) {
      async function run(line) {
        const ids = sessionCandidates(ctx)
        if (ids.length === 0) throw new Error('找不到任何会话，无法执行 /skills 命令')
        let busy = 0
        let lastError = null
        for (const id of ids.slice(0, 8)) {
          const res = await ctx.remote.commands.execute(id, line, [])
          if (res && res.ok === true) return parseResult(res, line)
          const code = res && res.error ? String(res.error.code || '') : ''
          const message = res && res.error ? String(res.error.message || '') : ''
          if (code === 'session/agent-busy' || /agent-busy/.test(message)) {
            busy += 1
            continue
          }
          lastError = code + ': ' + message
          break
        }
        if (lastError) throw new Error('命令执行失败（' + lastError + '）')
        if (busy > 0) throw new Error('会话正忙（agent-busy）：等本轮回答结束后再点一次')
        throw new Error('命令执行失败：没有可用会话')
      }
      return {
        load: function () { return run('/skills list') },
        toggle: function (name, on) { return run('/skills toggle ' + name + ' ' + (on ? 'on' : 'off')) },
        pack: function (label, on) { return run('/skills pack ' + label + ' ' + (on ? 'on' : 'off')) },
        rename: function (name, alias) { return run(('/skills rename ' + name + ' ' + (alias || '')).trim()) },
      }
    }

    function Toggle(props) {
      return h('button', {
        type: 'button',
        'aria-pressed': props.checked ? 'true' : 'false',
        'aria-label': props.label,
        onClick: props.onChange,
        style: {
          position: 'relative', width: 38, height: 22, flex: '0 0 auto', padding: 0,
          borderRadius: 11, border: 'none', cursor: 'pointer',
          background: props.checked ? '#2563EB' : 'rgba(127,127,127,0.35)',
          transition: 'background 120ms ease',
        },
      }, h('span', {
        style: {
          position: 'absolute', top: 3, left: props.checked ? 19 : 3, width: 16, height: 16,
          borderRadius: 8, background: '#fff', transition: 'left 120ms ease',
        },
      }))
    }

    function SkillRow(props) {
      const s = props.skill
      return h('div', { style: Object.assign({}, CSS.row, s.enabled ? {} : { opacity: 0.55 }) },
        h(Toggle, {
          checked: s.enabled,
          label: s.name,
          onChange: function () { props.onToggle(s) },
        }),
        h('div', { style: { flex: '1 1 auto', minWidth: 0 } },
          h('div', null,
            h('span', { style: CSS.name }, s.alias || s.name),
            s.alias ? h('span', { style: CSS.alias }, '(' + s.name + ')') : null),
          s.description ? h('div', { style: CSS.desc }, s.description) : null),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          h('span', { style: CSS.cost }, '≈' + s.tokens),
          h('button', {
            type: 'button',
            style: CSS.btn,
            title: '设置别名',
            onClick: function () { props.onRename(s) },
          }, '改名')))
    }

    function PackBlock(props) {
      const pack = props.pack
      const allOn = pack.total > 0 && pack.enabled === pack.total
      const some = pack.enabled > 0 && !allOn
      const knob = allOn ? 19 : (some ? 11 : 3)
      return h('div', null,
        h('div', { style: CSS.packBar },
          h('button', {
            type: 'button',
            title: allOn ? '整包关闭' : '整包开启',
            'aria-label': '整包开关 ' + pack.label,
            onClick: function () { props.onPackToggle(pack, !allOn) },
            style: {
              position: 'relative', width: 38, height: 22, flex: '0 0 auto', padding: 0,
              borderRadius: 11, border: 'none', cursor: 'pointer',
              background: allOn ? '#2563EB' : (some ? 'rgba(37,99,235,0.45)' : 'rgba(127,127,127,0.35)'),
            },
          }, h('span', {
            style: { position: 'absolute', top: 3, left: knob, width: 16, height: 16, borderRadius: 8, background: '#fff' },
          })),
          h('div', { style: { flex: '1 1 auto' } },
            h('div', { style: CSS.packName }, pack.label),
            h('div', { style: CSS.packMeta }, pack.total + ' 个技能 · 已开 ' + pack.enabled))),
        props.skills.map(function (s) {
          return h(SkillRow, {
            key: s.name,
            skill: s,
            onToggle: props.onToggle,
            onRename: props.onRename,
          })
        }))
    }

    function SkillSwitchSection(props) {
      const api = props.api
      const store = React.useState({ status: 'loading', data: null, error: null })
      const state = store[0]
      const setState = store[1]
      const busyStore = React.useState(false)
      const busy = busyStore[0]
      const setBusy = busyStore[1]

      React.useEffect(function () {
        let alive = true
        api.load().then(function (data) {
          if (alive) setState({ status: 'ready', data: data, error: null })
        }).catch(function (err) {
          if (alive) setState({ status: 'error', data: null, error: String(err && err.message ? err.message : err) })
        })
        return function () { alive = false }
      }, [])

      function act(promiseFactory) {
        if (busy) return
        setBusy(true)
        promiseFactory().then(function (data) {
          if (data && data.skills) setState({ status: 'ready', data: data, error: null })
        }).catch(function (err) {
          setState(function (prev) {
            return { status: prev.data ? 'ready' : 'error', data: prev.data, error: String(err && err.message ? err.message : err) }
          })
        }).then(function () { setBusy(false) })
      }

      if (state.status === 'loading') {
        return h('div', { style: CSS.wrap }, h('div', { style: CSS.hint }, '正在读取技能…'))
      }

      if (state.status === 'error') {
        return h('div', { style: CSS.wrap },
          h('h3', { style: CSS.title }, '技能开关'),
          h('div', { style: CSS.error }, state.error),
          h('button', { type: 'button', style: CSS.btn, onClick: function () { location.reload() } }, '重新加载页面'))
      }

      const data = state.data
      if (!data || data.total === 0) {
        return h('div', { style: CSS.wrap },
          h('h3', { style: CSS.title }, '技能开关'),
          h('div', { style: CSS.hint }, '还没有安装任何技能。把技能目录放到 ~/.dsh/skills 下即可。'))
      }

      function onToggle(skill) {
        act(function () { return api.toggle(skill.name, !skill.enabled) })
      }

      function onRename(skill) {
        const next = window.prompt('给「' + skill.name + '」起个别名（留空恢复原名）', skill.alias || '')
        if (next === null) return
        act(function () { return api.rename(skill.name, next.trim()) })
      }

      function onPackToggle(pack, on) {
        act(function () { return api.pack(pack.id, on) })
      }

      const blocks = data.packs.map(function (pack) {
        return h(PackBlock, {
          key: pack.id,
          pack: pack,
          skills: data.skills.filter(function (s) { return s.pack === pack.id }),
          onToggle: onToggle,
          onRename: onRename,
          onPackToggle: onPackToggle,
        })
      })

      return h('div', { style: CSS.wrap },
        h('div', { style: CSS.head },
          h('h3', { style: CSS.title }, '技能开关'),
          h('div', { style: CSS.summary }, data.total + ' 个技能 · 开启 ' + data.enabled)),
        h('div', { style: CSS.hint }, '改动立即写入 SKILL.md，下一个模型步骤生效。别名只影响显示。'),
        state.error ? h('div', { style: CSS.error }, state.error) : null,
        blocks)
    }

    function apply(ctx) {
      const api = makeApi(ctx)
      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register({
          name: 'settings.section',
          id: 'skill-switch',
          order: 80,
          label: function () { return '技能开关' },
          inject: function () { return { api: api } },
        }, SkillSwitchSection)
      })
    }

    return {
      inject: ['slots', 'remote', 'remote.commands', 'sessions'],
      apply: apply,
    }
  },
})
