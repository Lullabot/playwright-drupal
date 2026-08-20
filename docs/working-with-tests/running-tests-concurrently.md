# Running Tests Concurrently

`definePlaywrightDrupalConfig()` asks for `cpus - 2` workers, so a single suite
already claims nearly the whole machine. That is the right default for the
common case — one developer, one checkout, one run at a time — and it is the
wrong default the moment two runs overlap.

Overlap is easy to arrange without noticing. Each git worktree is normally its
own DDEV project, CI-style scripts get run by hand, and coding agents will
happily start a suite in one worktree while another is still going. Neither run
can see the other, so both keep asking for `cpus - 2` workers on a machine that
has one set of CPUs. Two suites at once do not each take half the time; they
take longer than running them back to back, and they starve each other badly
enough to fail visual comparisons that have nothing wrong with them.

There are two ways to deal with this, and they solve different problems.

## Dialing Down a Single Run

`PLAYWRIGHT_WORKERS` overrides the worker count for one invocation:

```console
PLAYWRIGHT_WORKERS=4 ddev task playwright:run
```

It accepts a positive integer or a percentage, matching Playwright's own
`workers` option:

```console
PLAYWRIGHT_WORKERS=50% ddev task playwright:run
```

This is the tool for "I know something else is using this machine right now."
It deliberately takes precedence over a `workers` value passed to
`definePlaywrightDrupalConfig()`, because the point is to adjust a run without
editing a config file that is shared and committed. Playwright's own
`--workers` flag still wins over both.

An unusable value — `PLAYWRIGHT_WORKERS=lots`, `PLAYWRIGHT_WORKERS=0` — raises
an error rather than falling back to the default. Silently running a whole
suite at the wrong parallelism is worse than refusing to start.

## Serialising Runs Across the Machine

`PLAYWRIGHT_WORKERS` still relies on somebody knowing to set it. The mutex
removes that requirement: with it enabled, one Playwright run happens at a time
across every DDEV project on the machine, and the second one is told so.

It is **off by default**. Turn it on by setting `PLAYWRIGHT_MUTEX=1` in the web
container's environment — most easily in `.ddev/config.yaml`:

```yaml
web_environment:
  - PLAYWRIGHT_MUTEX=1
```

or `.ddev/config.local.yaml` if you would rather it stay out of git. Run
`ddev restart` afterwards.

`playwright:run`, `playwright:visualdiff` and `playwright:regenerate` then take
the lock for the whole of their work, `playwright:install` included — rebuilding
the test site is itself expensive enough to be worth serialising.

### What Happens When the Lock Is Taken

The default is to queue, waiting up to 30 minutes:

```console
$ ddev task playwright:visualdiff
playwright-mutex: another Playwright run is held by project 'my-site-review' for 6m (started 2026-08-20 09:12:44).
playwright-mutex: waiting up to 1800s for it to finish.
```

Set `PLAYWRIGHT_MUTEX_WAIT` to change that number of seconds, or
`PLAYWRIGHT_MUTEX_FAIL_FAST=1` to be refused immediately instead. Refusing is
the better choice when the caller has something else it could be doing —
notably a coding agent, which would otherwise sit in a queue for half an hour.

A refusal exits **75** (`EX_TEMPFAIL`), which no Playwright exit status uses, so
"busy" is never mistaken for "tests failed". Nothing has run at that point:
wait for the other suite and issue the same command again.

!!! note "Exit codes through `task`"

    Task reports a failing task as exit status **201** regardless of what the
    command returned. To see the 75 — or Playwright's own exit code — pass
    `-x`: `ddev task -x playwright:run`. The message on stderr identifies a
    mutex refusal either way.

### Where the Lock Lives

The lock file is on `ddev-global-cache`, the Docker named volume DDEV mounts
into every project's web container at `/mnt/ddev-global-cache`. That is one
inode on the host, so `flock(2)` is honoured across containers. Nothing needs
adding to `docker-compose`, and no project needs restarting for another
project's lock to apply to it.

The kernel releases the lock however the holder dies — cleanly, killed, or with
the container stopped underneath it — so there is never a stale lock to clear
by hand.

If the volume is not mounted, the mutex prints a warning and runs anyway. There
is nothing to contend with outside DDEV, and a lock that cannot be taken must
not stop anyone running their tests.

### CI

The mutex is skipped whenever `CI` is set, even with `PLAYWRIGHT_MUTEX=1`.
Hosted runners get a machine each, sharded runs (`playwright:run shard=1/3`)
are *supposed* to overlap, and several jobs on one self-hosted runner share a
Docker daemon — and therefore this volume — so a lock there would turn a
correct parallel build into a queue or a pile of failures.

`PLAYWRIGHT_MUTEX=force` overrides this for the rare CI machine that really
does need serialising.

### Reference

| Variable | Default | Effect |
|---|---|---|
| `PLAYWRIGHT_MUTEX` | unset | `1` enables the lock; `force` enables it on CI too; anything else runs unchanged |
| `PLAYWRIGHT_MUTEX_WAIT` | `1800` | Seconds to wait for the lock before giving up |
| `PLAYWRIGHT_MUTEX_FAIL_FAST` | unset | `1` refuses immediately instead of waiting |
| `PLAYWRIGHT_MUTEX_DIR` | `/mnt/ddev-global-cache/playwright` | Where the lock file lives |

### Wrapping Your Own Commands

The mutex is a plain wrapper, published as the `playwright-drupal-mutex` bin,
so anything else competing for the same CPUs can take the same lock. `npx`
resolves it from `test/playwright/node_modules/.bin`:

```yaml
  fixtures:refresh:
    dir: test/playwright
    cmds:
      # A long database import that then warms the site should queue rather
      # than be thrown away half an hour in, so give it a long wait.
      - PLAYWRIGHT_MUTEX_WAIT=3600 npx playwright-drupal-mutex npx playwright test --ignore-snapshots
```

Nested invocations pass straight through: the wrapper exports
`PLAYWRIGHT_MUTEX_HELD=1` for the command it runs, so a locked task that calls
another locked task does not block against a lock its own process tree holds.

## Refusing a Run Before It Starts

The mutex is checked when a task starts, which for `playwright:run` is after
`playwright:install` has rebuilt the test site. A coding agent can therefore
spend several minutes on a run it was never going to be allowed to finish.

Claude Code can be told to refuse those commands up front with a `PreToolUse`
hook. This is a per-project thing rather than something the package ships, both
because it depends on your task names and because a hook that can stop a
developer running tests should be something you opted into deliberately. Adapt
and save as `.claude/hooks/playwright-mutex-gate.sh`:

```bash
#!/usr/bin/env bash
# Refuse to start a Playwright run while another one holds the mutex.
#
# Everything here fails open. A hook that cannot reach Docker must not be able
# to stop someone running their tests; the worst case is the mutex itself
# refusing the run a few minutes later, which is what would have happened
# without the hook at all.
set -uo pipefail

input=$(cat)

command -v jq >/dev/null 2>&1 || exit 0
command -v docker >/dev/null 2>&1 || exit 0

[ "$(jq -r '.tool_name // empty' <<<"$input" 2>/dev/null)" = "Bash" ] || exit 0
cmd=$(jq -r '.tool_input.command // empty' <<<"$input" 2>/dev/null)
[ -n "$cmd" ] || exit 0

# An escape hatch, and the commands worth gating. Anything else -- reading a
# report, listing snapshots, editing a spec -- is untouched.
case "$cmd" in
  *"#no-playwright-mutex"*) exit 0 ;;
  *"playwright test"* | *playwright:run* | *playwright:visualdiff* | \
  *playwright:regenerate* | *playwright:install*) ;;
  *) exit 0 ;;
esac

# The volume's host path under /var/lib/docker is root-only, so probe through
# any running DDEV web container -- they all mount the same volume.
container=$(docker ps --filter 'label=com.ddev.site-name' --filter 'status=running' \
  --format '{{.Names}}' 2>/dev/null | grep -E -- '-web$' | head -n 1)
[ -n "$container" ] || exit 0

# Exit 3 means held. `flock -n` releases immediately when it succeeds, so
# probing never blocks a real run.
holder=$(timeout 15 docker exec "$container" sh -c '
  dir=/mnt/ddev-global-cache/playwright
  [ -e "$dir/mutex.lock" ] || exit 0
  flock -n "$dir/mutex.lock" true && exit 0
  cat "$dir/mutex.holder" 2>/dev/null
  exit 3
' 2>/dev/null)
[ "$?" -eq 3 ] || exit 0

project=$(sed -n 's/^project=//p' <<<"$holder" | head -n 1)

reason="A Playwright run is already in progress on this machine${project:+ (project $project)}.

Playwright runs with cpus-2 workers, so it already uses nearly the whole
machine. A second suite would make both runs slower than running them one
after the other, and CPU starvation shows up as visual comparison failures
that look like real regressions.

Do not run it now, and do not poll in a tight loop. Get on with other work and
try again in a few minutes; a full suite takes anywhere from 5 to 30 minutes."

jq -n --arg reason "$reason" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: $reason
  }
}'
exit 0
```

Register it in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/playwright-mutex-gate.sh"
          }
        ]
      }
    ]
  }
}
```

Two things to know about it. Claude Code reads `.claude/settings.json` at
startup, so the hook only applies to sessions started after it is on disk — a
session that was already running when you added it will still reach the mutex
instead, which is the designed fallback rather than a failure. And `ddev
playwright test`, from the
[ddev-playwright](https://github.com/lullabot/ddev-playwright) add-on, does not
take the lock: the hook will refuse it while somebody else is running, but a
run started that way holds nothing, and other runs will start on top of it.
Prefer `ddev task playwright:run`.
