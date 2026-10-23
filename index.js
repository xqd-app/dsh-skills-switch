import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const SKILL_ROOT = join(DSH_HOME, 'skills')
const STATE_DIR = join(DSH_HOME, 'skill-panel')
const PACKS_FILE = join(STATE_DIR, 'packs.json')
const ALIAS_FILE = join(STATE_DIR, 'aliases.json')

const SUPERPOWERS = [
  'brainstorming', 'diagnosing-superpowers', 'dispatching-parallel-agents', 'executing-plans',
  'finishing-a-development-branch', 'receiving-code-review', 'requesting-code-review',
  'subagent-driven-development', 'systematic-debugging', 'test-driven-development',
  'using-git-worktrees', 'using-superpowers', 'verification-before-completion', 'writing-plans',
  'writing-skills',
]

function readJson (path, fallback) {
  try {
    if (!existsSync(path)) return fallback
    const raw = readFileSync(path, 'utf8')
    if (!raw.trim()) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writeJson (path, value) {
  mkdirSync(STATE_DIR, { recursive: true })
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

/** Split a SKILL.md into frontmatter body + rest, preserving line endings. */
function splitFrontmatter (text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(text)
  if (!m) return null
  return {
    fm: m[1],
    rest: text.slice(m[0].length),
    eol: m[2] === '\r\n' ? '\r\n' : '\n',
    hadEol: m[2].length > 0,
  }
}

function unquote (value) {
  const v = value.trim()
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) {
    return v.slice(1, -1).replace(/''/g, "'")
  }
  return v
}

export function listSkills () {
  if (!existsSync(SKILL_ROOT)) return []
  const out = []
  for (const name of readdirSync(SKILL_ROOT)) {
    const dir = join(SKILL_ROOT, name)
    try {
      if (!statSync(dir).isDirectory()) continue
    } catch {
      continue
    }
    const file = join(dir, 'SKILL.md')
    if (!existsSync(file)) continue
    const text = readFileSync(file, 'utf8')
    const parts = splitFrontmatter(text)
    let description = ''
    let enabled = true
    if (parts) {
      const d = /^description:\s*(.+)$/m.exec(parts.fm)
      if (d) description = unquote(d[1])
      const flag = /^disable-model-invocation:\s*(\S+)\s*$/m.exec(parts.fm)
      if (flag && /^(true|yes|on|1)$/i.test(flag[1])) enabled = false
    }
    out.push({
      name,
      path: file,
      description,
      enabled,
      tokens: Math.round(Buffer.byteLength(name + ' ' + description, 'utf8') / 4),
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

export function setSkillEnabled (name, on) {
  const file = join(SKILL_ROOT, name, 'SKILL.md')
  if (!existsSync(file)) return { ok: false, error: `skill not found: ${name}` }
  const text = readFileSync(file, 'utf8')
  const parts = splitFrontmatter(text)
  if (!parts) return { ok: false, error: `SKILL.md has no frontmatter: ${name}` }
  const line = `disable-model-invocation: ${on ? 'false' : 'true'}`
  const fm = /^disable-model-invocation:/m.test(parts.fm)
    ? parts.fm.replace(/^disable-model-invocation:.*$/m, line)
    : parts.fm + parts.eol + line
  const tail = parts.hadEol ? parts.rest : parts.eol + parts.rest
  writeFileSync(file, '---' + parts.eol + fm + parts.eol + '---' + parts.eol + tail, 'utf8')
  return { ok: true, name, enabled: on }
}

export function packConfig () {
  const cfg = readJson(PACKS_FILE, null)
  if (cfg && Array.isArray(cfg.packs)) return cfg
  const present = listSkills().map((s) => s.name)
  const sp = SUPERPOWERS.filter((n) => present.includes(n))
  return {
    version: 1,
    packs: sp.length ? [{ id: 'superpowers', label: 'Superpowers', skills: sp }] : [],
  }
}

export function syncPacks () {
  const skills = listSkills()
  const cfg = packConfig()
  const known = new Set()
  for (const p of cfg.packs) for (const s of p.skills) known.add(s)
  const unknown = skills.map((s) => s.name).filter((n) => !known.has(n))
  if (unknown.length) {
    let un = cfg.packs.find((p) => p.id === '_ungrouped')
    if (!un) {
      un = { id: '_ungrouped', label: '未分组', skills: [] }
      cfg.packs.push(un)
    }
    un.skills = [...un.skills, ...unknown]
  }
  const names = new Set(skills.map((s) => s.name))
  for (const p of cfg.packs) p.skills = p.skills.filter((s) => names.has(s))
  cfg.packs = cfg.packs.filter((p) => p.skills.length > 0)
  writeJson(PACKS_FILE, cfg)
  return cfg
}

export function aliases () {
  return readJson(ALIAS_FILE, {}) || {}
}

export function setAlias (name, alias) {
  const map = aliases()
  if (!alias || !alias.trim()) delete map[name]
  else map[name] = alias.trim()
  writeJson(ALIAS_FILE, map)
  return { ok: true, name, alias: alias || '' }
}

/** Everything the UI needs in one payload. */
export function snapshot () {
  const cfg = syncPacks()
  const skills = listSkills()
  const aliasMap = aliases()
  return {
    skills: skills.map((s) => ({
      ...s,
      alias: aliasMap[s.name] || '',
      pack: (cfg.packs.find((p) => p.skills.includes(s.name)) || {}).id || '',
    })),
    packs: cfg.packs.map((p) => ({
      id: p.id,
      label: aliasMap[p.id] || p.label,
      skills: p.skills,
      enabled: skills.filter((s) => p.skills.includes(s.name) && s.enabled).length,
      total: p.skills.length,
    })),
    total: skills.length,
    enabled: skills.filter((s) => s.enabled).length,
  }
}

export const name = 'dsh-skill-switch'
export const inject = ['commands']

export function apply (ctx) {
  ctx.commands.register({
    name: 'skills',
    description: 'List, toggle, rename or regroup DSH skills',
    input: { hint: 'list | toggle <name> <on|off> | pack <label> <on|off> | rename <name> <alias>' },
    handler: ({ rawInput }) => {
      const text = (rawInput || '').trim()
      const [verb, ...rest] = text.split(/\s+/).filter(Boolean)
      try {
        if (!verb || verb === 'list') {
          return { kind: 'success', text: JSON.stringify(snapshot()) }
        }
        if (verb === 'toggle') {
          const [skill, state] = rest
          if (!skill || !/^(on|off)$/i.test(state || '')) {
            return { kind: 'error', text: 'usage: /skills toggle <name> <on|off>' }
          }
          const r = setSkillEnabled(skill, state.toLowerCase() === 'on')
          return r.ok
            ? { kind: 'success', text: JSON.stringify(snapshot()) }
            : { kind: 'error', text: r.error }
        }
        if (verb === 'pack') {
          const label = rest[0]
          const state = rest[1]
          if (!label || !/^(on|off)$/i.test(state || '')) {
            return { kind: 'error', text: 'usage: /skills pack <label> <on|off>' }
          }
          const cfg = syncPacks()
          const p = cfg.packs.find((x) => x.label === label || x.id === label)
          if (!p) return { kind: 'error', text: `pack not found: ${label}` }
          for (const s of p.skills) setSkillEnabled(s, state.toLowerCase() === 'on')
          return { kind: 'success', text: JSON.stringify(snapshot()) }
        }
        if (verb === 'rename') {
          const skill = rest[0]
          const alias = rest.slice(1).join(' ')
          if (!skill) return { kind: 'error', text: 'usage: /skills rename <name> <alias>' }
          setAlias(skill, alias)
          return { kind: 'success', text: JSON.stringify(snapshot()) }
        }
        return { kind: 'error', text: `unknown subcommand: ${verb}` }
      } catch (err) {
        return { kind: 'error', text: String(err && err.message ? err.message : err) }
      }
    },
  })
}
