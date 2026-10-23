# dsh-skills-switch

A DeepSeek Harness (DSH) plugin that adds a **Skill Switch** page to the Settings window: see every skill installed in the profile, flip each one on or off, switch a whole pack at once, and give skills your own display names.

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
