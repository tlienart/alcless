import { execa, type Options, type Result } from 'execa';
import { logger } from './logger.ts';

export interface ExecOptions extends Options {
  /**
   * If true, suppresses stdout and stderr unless an error occurs.
   * Defaults to true as per the "focused" requirement.
   */
  silent?: boolean;
  /**
   * Optional timeout in milliseconds.
   */
  timeoutMs?: number;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
}

/**
 * Executes a command with focused logging.
 */
export async function run(
  file: string,
  args: string[],
  options: ExecOptions = {}
): Promise<RunResult> {
  const { silent = true, timeoutMs = 120000, ...execaOptions } = options;

  if (process.env.DEBUG) {
    logger.debug(`Running: ${file} ${args.join(' ')}`);
  }

  try {
    const result = await execa(file, args, {
      ...execaOptions,
      timeout: timeoutMs,
      // Ensure we always capture output even if silent
      all: true,
    }) as Result;

    return {
      stdout: String(result.stdout ?? ''),
      stderr: String(result.stderr ?? ''),
      exitCode: result.exitCode ?? 0,
      command: result.command ?? '',
    };
  } catch (error: any) {
    if (error.timedOut) {
      throw new Error(`Command timed out after ${timeoutMs}ms: ${file} ${args.join(' ')}`);
    }
    const result = error as Result;
    throw new Error(
      `Command failed: ${result.command}\n` +
      `Exit code: ${result.exitCode}\n` +
      `Output: ${result.all || result.stderr || result.message}`
    );
  }
}


export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
}

/**
 * Ensures sudo is authenticated before starting automated tasks.
 * This will prompt the user for a password in the terminal if needed.
 */
export async function ensureSudo(): Promise<void> {
  try {
    // -v validates the sudo credentials, prompting if necessary.
    // We use inherit for stdio to allow the password prompt to be visible.
    await execa('sudo', ['-v'], { stdio: 'inherit' });
  } catch (err) {
    throw new Error('Sudo authentication failed. This tool requires sudo privileges.');
  }
}

/**
 * Executes a command with focused logging.
 */
export async function run(
  file: string,
  args: string[],
  options: ExecOptions = {}
): Promise<RunResult> {
  const { silent = true, ...execaOptions } = options;

  try {
    const result = await execa(file, args, {
      ...execaOptions,
      // Ensure we always capture output even if silent
      all: true,
    }) as Result;

    return {
      stdout: String(result.stdout ?? ''),
      stderr: String(result.stderr ?? ''),
      exitCode: result.exitCode ?? 0,
      command: result.command ?? '',
    };
  } catch (error: any) {
    const result = error as Result;
    throw new Error(
      `Command failed: ${result.command}\n` +
      `Exit code: ${result.exitCode}\n` +
      `Output: ${result.all || result.stderr || result.message}`
    );
  }
}

/**
 * Executes a command with sudo.
 */
export async function sudoRun(
  file: string,
  args: string[],
  options: ExecOptions = {}
): Promise<RunResult> {
  // Use -n for non-interactive sudo (fails if password is required)
  return run('sudo', ['-n', file, ...args], options);
}

/**
 * Executes a command as a specific user using sudo su -.
 */
export async function runAsUser(
  username: string,
  command: string,
  options: ExecOptions = {}
): Promise<RunResult> {
  // We use su - to simulate a full login shell
  return sudoRun('su', ['-', username, '-c', command], options);
}
