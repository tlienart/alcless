# Plan: Automate Multiple Session Creation in Alcoholless

This plan outlines the changes needed to allow `alclessctl create` to generate multiple user sessions in one command, with options to automate the process and avoid interactive prompts.

## Goals
1. Support multiple instance names in `alclessctl create`.
2. Add a flag to specify the user password (allowing empty password for automation).
3. Ensure the process is non-interactive when requested (using `--yes`).
4. Improve the experience by caching `sudo` credentials once at the beginning.

## Proposed Changes

### 1. Command Line Interface (`cmd/alclessctl/commands/create/create.go`)
- **Modify `Args`**: Change `cobra.MaximumNArgs(1)` to `cobra.ArbitraryArgs` (or `MinimumNArgs(0)` to keep current default behavior).
- **Add Flag**: Add `--user-password` flag.
    - Default: `""` (but we'll need to decide how to handle the "interactive if TTY" logic).
    - Actually, let's keep the current behavior as default but allow override.
- **Update `action`**:
    - Iterate over all provided arguments.
    - If no arguments are provided, default to `["default"]`.
    - For each instance name:
        - Resolve the name.
        - Check if user exists.
        - Run `AddUserCmds` and `brew.InstallCmds`.
- **Pre-flight `sudo -v`**: Before starting the loop, if not in a dry-run or if we know we'll need `sudo`, run `sudo -v` once to prompt for the admin password if necessary.

### 2. User Utilities (`pkg/userutil/userutil_darwin.go`)
- **Update `AddUserCmds`**:
    - Add a `userPassword` parameter.
    - Fix the shadowing bug where a generated password was not actually used.
    - Current code has a bug: `pw, err := password.Generate(...)` inside an `if` block shadows the outer `pw`, so `sysadminctl` always gets `"-"`.
    - Logic:
        - If `userPassword` is explicitly provided (even if empty string), use it.
        - If `userPassword` is not provided (e.g., a special value):
            - If TTY, use `"-"` (interactive).
            - If not TTY, generate a random password.

### 3. Command Utilities (`pkg/cmdutil/cmdutil.go`)
- **Add `SudoV`**: A helper to run `sudo -v` to ensure credentials are cached.

### 4. Sudo Utilities (`pkg/sudo/sudo.go`)
- (Optional) Add a check if `sudo` is needed.

## PR Strategy
1. **Setup Remote**: Add the fork `https://github.com/tlienart/alcless` as a git remote.
2. **Branching**: Create a new branch `automation-batch-creation` from the current main branch.
3. **Implementation**: Execute the code changes as outlined in the "Proposed Changes" section.
4. **Submission**: Push the branch to the fork and create a Pull Request.
    - If the goal is to contribute back to the original repo: PR from `tlienart:automation-batch-creation` to `AkihiroSuda:main`.
    - If the goal is to maintain a custom version: PR within the fork. (I will clarify this with the user).

## Detailed Steps

### Step 1: Update `pkg/userutil`
Modify `AddUserCmds` to accept an optional password.

### Step 2: Update `cmd/alclessctl/commands/create`
Modify the `create` command to handle multiple arguments and the new flag.

### Step 3: Implement `sudo -v` caching
Add a call to `sudo -v` at the beginning of the `create` command's `action` function to ensure the user is only prompted for their admin password once.

### Step 4: Fix Shadowing Bug
Correct the shadowing of `pw` in `pkg/userutil/userutil_darwin.go` to ensure generated passwords (or provided ones) are correctly passed to `sysadminctl`.

## Verification Plan
1. Test creating a single session: `alclessctl create test1`.
2. Test creating multiple sessions: `alclessctl create test1 test2 test3`.
3. Test automation with empty password: `alclessctl create auto1 auto2 --yes --user-password ""`.
4. Verify that `sudo` password is only asked once at the beginning.
5. Verify that no interactive prompts appear when `--yes` and `--user-password ""` are used.
