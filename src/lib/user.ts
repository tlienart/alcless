import { run, sudoRun, runAsUser } from './exec.ts';
import { logger } from './logger.ts';

export interface UserInfo {
  username: string;
  instanceName: string;
}

/**
 * Gets the current host username.
 */
export async function getHostUser(): Promise<string> {
  const { stdout } = await run('whoami', []);
  return stdout.trim();
}

/**
 * Generates the alcless username for an instance.
 */
export async function getSessionUsername(instanceName: string): Promise<string> {
  const hostUser = await getHostUser();
  // Using alcl_ to keep it short (macOS limit is 32)
  return `alcl_${hostUser}_${instanceName}`;
}

/**
 * Checks if a user exists on the system.
 */
export async function userExists(username: string): Promise<boolean> {
  try {
    await run('dscl', ['.', '-read', `/Users/${username}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a user exists and is recognized by the system identity resolver.
 */
export async function isUserActive(username: string): Promise<boolean> {
  try {
    await run('id', ['-u', username]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if the network is available within the user session.
 */
async function isNetworkReady(username: string): Promise<boolean> {
  try {
    // Try to resolve github.com (common dependency)
    await runAsUser(username, 'host github.com || nslookup github.com || ping -c 1 github.com');
    return true;
  } catch {
    return false;
  }
}

/**
 * Polls until the user is recognized by the system and network is ready.
 */
async function waitForUserReady(username: string, maxAttempts = 15): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const active = await isUserActive(username);
    if (active) {
      // Once active, wait for network to stabilize
      if (await isNetworkReady(username)) return;
      logger.debug(`Waiting for network to stabilize for ${username}...`);
    } else {
      logger.debug(`Waiting for user ${username} to become active...`);
      // Flush directory service cache
      await sudoRun('dscacheutil', ['-flushcache']);
      try {
        await sudoRun('killall', ['-HUP', 'opendirectoryd']);
      } catch { /* ignore if fails */ }
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error(`User ${username} setup timed out (active: ${await isUserActive(username)}, network: ${await isNetworkReady(username)}).`);
}

/**
 * Creates a new macOS user session with no password.
 */
export async function createSessionUser(instanceName: string): Promise<string> {
  const username = await getSessionUsername(instanceName);
  
  const existsInDscl = await userExists(username);
  const active = await isUserActive(username);

  if (existsInDscl && active) {
    logger.debug(`User ${username} already exists and is active.`);
    // Still wait for network to be sure
    await waitForUserReady(username);
    return username;
  }

  if (!existsInDscl) {
    logger.info(`Creating macOS user account: ${username}...`);
    // -addUser <name> -password <pw> creates a standard user
    await sudoRun('sysadminctl', ['-addUser', username, '-password', '']);
    logger.success(`User record for ${username} created.`);
  }
  
  // Wait for the system to recognize the new user and network to be ready
  logger.info(`Waiting for ${username} to be fully resolved by the system...`);
  await waitForUserReady(username);

  // Ensure the home directory is correctly owned and restricted
  const homeDir = `/Users/${username}`;
  logger.info(`Fixing home directory permissions for ${username}...`);
  // We chown the home directory itself non-recursively to avoid SIP/TCC protected system folders in ~/Library
  await sudoRun('chown', [`${username}:staff`, homeDir]);
  await sudoRun('chmod', ['700', homeDir]);
  
  return username;
}

/**
 * Deletes a macOS user session.
 */
export async function deleteSessionUser(instanceName: string): Promise<void> {
  const username = await getSessionUsername(instanceName);
  
  if (!(await userExists(username))) {
    logger.debug(`User ${username} does not exist.`);
    return;
  }

  // -deleteUser <name> deletes the user and home directory
  await sudoRun('sysadminctl', ['-deleteUser', username]);
}
