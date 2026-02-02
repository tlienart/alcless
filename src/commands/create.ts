import { createSessionUser } from '../lib/user.ts';
import { sudoers } from '../lib/sudo.ts';
import { brew } from '../lib/brew.ts';
import { provisionSession } from '../lib/provision.ts';
import { MultiBar, Presets } from 'cli-progress';
import pLimit from 'p-limit';
import chalk from 'chalk';
import { logger } from '../lib/logger.ts';
import { ensureSudo } from '../lib/exec.ts';

export async function createCommand(instances: string[], options: { tools?: string; concurrency?: string }) {
  if (instances.length === 0) {
    logger.error('Please specify at least one instance name.');
    process.exit(1);
  }

  // Pre-flight sudo check
  await ensureSudo();

  console.log(chalk.yellow('⚠️  macOS may prompt you for "System Events" or "User Management" permissions.'));
  console.log(chalk.yellow('   Please click "Allow" or "OK" to proceed with session creation.\n'));

  const concurrency = parseInt(options.concurrency || '2', 10);
  const limit = pLimit(concurrency);
  const extraTools = options.tools ? options.tools.split(',').map(t => t.trim()) : [];

  console.log(chalk.bold(`🚀 Creating ${instances.length} session(s) (concurrency: ${concurrency})...`));

  const multibar = new MultiBar({
    clearOnComplete: false,
    hideCursor: true,
    format: '{bar} | {percentage}% | {instance} | {step}',
  }, Presets.shades_grey);

  const tasks = instances.map(instance => limit(async () => {
    const bar = multibar.create(100, 0, { instance, step: 'Initializing...' });
    
    try {
      // Step 1: Create User
      bar.update(10, { step: 'Creating user...' });
      await createSessionUser(instance);
      
      // Step 2: Sudoers
      bar.update(20, { step: 'Configuring sudo...' });
      await sudoers.setup(instance);
      
      // Step 3: Brew
      bar.update(30, { step: 'Installing Homebrew...' });
      await brew.install(instance);
      
      // Step 4: Provision tools
      bar.update(60, { step: 'Provisioning tools...' });
      await provisionSession(instance, extraTools);
      
      bar.update(100, { step: 'Finished!' });
    } catch (err: any) {
      bar.update(0, { step: chalk.red('Failed!') });
      multibar.stop();
      logger.error(`Error creating instance "${instance}": ${err.message}`);
      process.exit(1);
    }
  }));

  await Promise.all(tasks);
  multibar.stop();
  console.log(chalk.bold.green('\n✅ All sessions created successfully.'));
}
