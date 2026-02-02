import { brew } from './brew.ts';
import { runAsUser } from './exec.ts';
import { getSessionUsername } from './user.ts';

export const DEFAULT_TOOLS = [
  'git',
  'gh',
  'python@3.12',
  'uv',
];

/**
 * Provisions the session with the default toolchain.
 */
export async function provisionSession(instanceName: string, extraTools: string[] = []): Promise<void> {
  const sessionUser = await getSessionUsername(instanceName);
  
  // 1. Install brew-based tools
  const allTools = [...new Set([...DEFAULT_TOOLS, ...extraTools])];
  await brew.installPackages(instanceName, allTools);

  // 2. Install Bun (using the official installer for speed/isolation)
  // We can also use brew install bun, but the curl installer is often preferred for isolation.
  // However, since we have brew, let's stick to brew for consistency unless it's too slow.
  // Actually, let's add bun to the brew list if not there.
  if (!allTools.includes('bun')) {
    await brew.installPackages(instanceName, ['bun']);
  }

  // 3. Post-install tweaks (if any)
  // Example: link python3.12 as python3 if needed
  await runAsUser(sessionUser, 'ln -sf $($HOME/homebrew/bin/brew --prefix python@3.12)/bin/python3.12 $($HOME/homebrew/bin/brew --prefix python@3.12)/bin/python3');
}
