# dsh-skills-switch

A DeepSeek Harness (DSH) plugin that adds a **Skill Switch** page to the Settings window: see every skill installed in the profile, flip each one on or off, switch a whole pack at once, and give skills your own display names.
背景：
很多大规模技能包都是为复杂项目准备的，但在中小型任务中，真正需要的往往只是一小部分。即使只是加载 2–3 个较重的技能，例如 brainstorming、writing-plans 和 TDD，也可能额外带来 6k–9k token 的上下文成本，约相当于一次认真对话成本的 30%–40%。而在 subagent-driven development 场景中，这种开销会被进一步放大，因为每个任务都可能派发一个新的子代理，并为其创建独立上下文。实际情况下，总成本往往会提升 2–4 倍。

dsh-skills-switch 的目标，就是把这些子代理和技能做成可控的开关。只有在当前任务真正需要时才加载对应技能和子代理，从而显著降低 token 消耗、减少无效上下文、提升开发效率，并让 agent-driven workflow 更加可控、更适合真实项目使用。”

## What it does

- Lists every skill under `~/.dsh/skills` (bundle root: `<skill>/SKILL.md`).
- **Per-skill switch** — writes `disable-model-invocation: true|false` into that skill's `SKILL.md` frontmatter, the field DSH itself uses to hide a skill from the model catalog.
- **Per-pack switch** — three-state control (all on / mixed / all off) that applies to every skill in the pack.
- **Aliases** — display-only rename; the real `name` stays untouched, because DSH uses it as the skill id.
- Shows a per-skill token estimate so you can see what a switch actually saves.

## Install

```powershell
# from the bundled Desktop CLI (quit DSH first)
& "E:\deepseek HARNESS\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "link:C:\path\to\dsh-skill-switch"
```

Then start DSH and open **Settings → 技能开关**.

Changes to `index.js` / `client.js` need a page reload (Ctrl+R) or a restart.

## How it works

| Piece | Role |
|---|---|
| `index.js` | Host half. Reads/writes `SKILL.md` frontmatter, owns packs and aliases, registers the `/skills` command. |
| `client.js` | Browser half. Registers a `settings.section` slot and calls the host through `ctx.remote.commands.execute()`. |
| `cordis.patch.yml` | Loader patch that inserts the plugin row. |

State files (shared with the CLI companion, if present):

- `~/.dsh/skill-panel/packs.json` — pack membership
- `~/.dsh/skill-panel/aliases.json` — display names

## Slash command

The host half also registers `/skills`, so the same operations work from the composer:

```
/skills list
/skills toggle <name> on|off
/skills pack <label> on|off
/skills rename <name> <alias>
```

## Known limitations

- The panel needs an idle session to run a command. While a conversation is streaming, it reports `agent-busy` and you should retry when the turn ends.
- Only skills in `~/.dsh/skills` are managed. Skills bundled inside `app.asar` (for example the `office` family) are not listed and cannot be switched.

## License

MIT
