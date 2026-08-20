#!/usr/bin/env bats

# mutex.bats — Unit tests for bin/playwright-mutex.
#
# Unlike the other files in this directory these need neither DDEV nor Docker:
# the lock location is pointed at a temporary directory, so everything runs in
# a couple of seconds.

setup() {
  MUTEX="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)/bin/playwright-mutex"
  export MUTEX

  # Stands in for the ddev-global-cache mount point. The script expects the
  # parent of the lock directory to exist and creates the rest itself.
  VOLUME="$BATS_TEST_TMPDIR/volume"
  LOCK_DIR="$VOLUME/playwright"
  mkdir -p "$VOLUME"
  export PLAYWRIGHT_MUTEX_DIR="$LOCK_DIR"

  # Inherited state would make these tests pass or fail depending on the shell
  # they were started from.
  unset PLAYWRIGHT_MUTEX PLAYWRIGHT_MUTEX_WAIT PLAYWRIGHT_MUTEX_FAIL_FAST
  unset PLAYWRIGHT_MUTEX_HELD CI
  export DDEV_SITENAME=bats-project
}

teardown() {
  if [ -n "${HOLDER_PID:-}" ]; then
    kill "$HOLDER_PID" 2>/dev/null || true
    wait "$HOLDER_PID" 2>/dev/null || true
  fi
}

# Take the lock in a background process for a given number of seconds, and do
# not return until it is actually held — otherwise the test races the holder.
hold_lock() {
  local seconds="${1:-10}"
  mkdir -p "$LOCK_DIR"
  : >"$LOCK_DIR/mutex.lock"
  {
    echo "project=other-project"
    echo "pid=424242"
    echo "started=$(($(date +%s) - 300))"
    echo "started_human=$(date '+%Y-%m-%d %H:%M:%S')"
    echo "command=npx playwright test"
  } >"$LOCK_DIR/mutex.holder"

  flock "$LOCK_DIR/mutex.lock" -c \
    "touch '$BATS_TEST_TMPDIR/held'; sleep $seconds" >/dev/null 2>&1 &
  HOLDER_PID=$!

  local waited=0
  while [ ! -f "$BATS_TEST_TMPDIR/held" ]; do
    sleep 0.05
    waited=$((waited + 1))
    [ "$waited" -lt 200 ] || return 1
  done
}

@test "mutex: exits 64 when given no command" {
  run "$MUTEX"
  [ "$status" -eq 64 ]
  [[ "$output" == *"usage:"* ]]
}

@test "mutex: is off by default and never touches the lock" {
  run "$MUTEX" echo hello
  [ "$status" -eq 0 ]
  [ "$output" = "hello" ]
  [ ! -e "$LOCK_DIR" ]
}

@test "mutex: PLAYWRIGHT_MUTEX=0 runs the command unchanged" {
  PLAYWRIGHT_MUTEX=0 run "$MUTEX" echo hello
  [ "$status" -eq 0 ]
  [ "$output" = "hello" ]
}

@test "mutex: runs the command and takes the lock when enabled" {
  PLAYWRIGHT_MUTEX=1 run "$MUTEX" echo hello
  [ "$status" -eq 0 ]
  [ "$output" = "hello" ]
  [ -e "$LOCK_DIR/mutex.lock" ]
}

@test "mutex: propagates the command's exit status" {
  PLAYWRIGHT_MUTEX=1 run "$MUTEX" sh -c 'exit 3'
  [ "$status" -eq 3 ]
}

@test "mutex: releases the lock when the command finishes" {
  PLAYWRIGHT_MUTEX=1 run "$MUTEX" true
  [ "$status" -eq 0 ]

  # A second run must not queue behind the first.
  PLAYWRIGHT_MUTEX=1 PLAYWRIGHT_MUTEX_FAIL_FAST=1 run "$MUTEX" echo second
  [ "$status" -eq 0 ]
  [ "$output" = "second" ]
}

@test "mutex: releases the lock when the command is killed" {
  PLAYWRIGHT_MUTEX=1 run "$MUTEX" sh -c 'kill -9 $$'
  [ "$status" -ne 0 ]

  PLAYWRIGHT_MUTEX=1 PLAYWRIGHT_MUTEX_FAIL_FAST=1 run "$MUTEX" echo after
  [ "$status" -eq 0 ]
  [ "$output" = "after" ]
}

@test "mutex: removes its holder breadcrumb afterwards" {
  PLAYWRIGHT_MUTEX=1 run "$MUTEX" true
  [ "$status" -eq 0 ]
  [ ! -e "$LOCK_DIR/mutex.holder" ]
}

@test "mutex: exits 75 and names the holder when told not to wait" {
  hold_lock 30
  PLAYWRIGHT_MUTEX=1 PLAYWRIGHT_MUTEX_FAIL_FAST=1 run "$MUTEX" echo should-not-run
  [ "$status" -eq 75 ]
  [[ "$output" != *"should-not-run"* ]]
  [[ "$output" == *"other-project"* ]]
  [[ "$output" == *"for 5m"* ]]
}

@test "mutex: exits 75 once a bounded wait runs out" {
  hold_lock 30
  PLAYWRIGHT_MUTEX=1 PLAYWRIGHT_MUTEX_WAIT=1 run "$MUTEX" echo should-not-run
  [ "$status" -eq 75 ]
  [[ "$output" == *"waiting up to 1s"* ]]
}

@test "mutex: queues until the holder is done" {
  hold_lock 2
  PLAYWRIGHT_MUTEX=1 PLAYWRIGHT_MUTEX_WAIT=30 run "$MUTEX" echo ran-after-waiting
  [ "$status" -eq 0 ]
  [[ "$output" == *"ran-after-waiting"* ]]
}

@test "mutex: warns about a non-numeric wait" {
  hold_lock 30
  PLAYWRIGHT_MUTEX=1 PLAYWRIGHT_MUTEX_WAIT=soon PLAYWRIGHT_MUTEX_FAIL_FAST=1 \
    run "$MUTEX" echo should-not-run
  [ "$status" -eq 75 ]
  [[ "$output" == *"non-numeric"* ]]
}

@test "mutex: passes nested invocations straight through" {
  hold_lock 30
  PLAYWRIGHT_MUTEX=1 PLAYWRIGHT_MUTEX_HELD=1 PLAYWRIGHT_MUTEX_FAIL_FAST=1 \
    run "$MUTEX" echo nested
  [ "$status" -eq 0 ]
  [ "$output" = "nested" ]
}

@test "mutex: marks the command it runs as holding the lock" {
  PLAYWRIGHT_MUTEX=1 run "$MUTEX" sh -c 'echo "$PLAYWRIGHT_MUTEX_HELD"'
  [ "$status" -eq 0 ]
  [ "$output" = "1" ]
}

@test "mutex: does nothing on CI" {
  hold_lock 30
  CI=true PLAYWRIGHT_MUTEX=1 PLAYWRIGHT_MUTEX_FAIL_FAST=1 run "$MUTEX" echo on-ci
  [ "$status" -eq 0 ]
  [ "$output" = "on-ci" ]
}

@test "mutex: PLAYWRIGHT_MUTEX=force locks even on CI" {
  hold_lock 30
  CI=true PLAYWRIGHT_MUTEX=force PLAYWRIGHT_MUTEX_FAIL_FAST=1 run "$MUTEX" echo on-ci
  [ "$status" -eq 75 ]
}

@test "mutex: warns and runs when the shared volume is absent" {
  PLAYWRIGHT_MUTEX=1 PLAYWRIGHT_MUTEX_DIR="$BATS_TEST_TMPDIR/absent/playwright" \
    run "$MUTEX" echo no-volume
  [ "$status" -eq 0 ]
  [[ "$output" == *"no-volume"* ]]
  [[ "$output" == *"is not mounted"* ]]
}
