import { runAsUser } from './exec.ts';
import { getSessionUsername } from './user.ts';
import { logger } from './logger.ts';

/**
 * Manages isolated Homebrew installation.
 */
export const brew = {
  /**
   * Installs Homebrew in the session user's home directory.
   */
  install: async (instanceName: string): Promise<void> => {
    const sessionUser = await getSessionUsername(instanceName);
    
    // 1. Clone Homebrew if it doesn't exist
    // We clone into ~/homebrew with retry logic
    const cloneCmd = 'if [ ! -d "$HOME/homebrew" ]; then git clone https://github.com/Homebrew/brew "$HOME/homebrew"; fi';
    
    let attempts = 3;
    while (attempts > 0) {
      try {
        await runAsUser(sessionUser, cloneCmd);
        break;
      } catch (err: any) {
        attempts--;
        if (attempts === 0) throw err;
        logger.warn(`Brew clone failed for ${instanceName}, retrying in 5s... (${attempts} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // 2. Setup environment variables in .zprofile and .bash_profile
    const setupCmd = 'eval "$($HOME/homebrew/bin/brew shellenv)"';
    await runAsUser(sessionUser, `grep -q "brew shellenv" ~/.zprofile || echo '${setupCmd}' >> ~/.zprofile`);
    await runAsUser(sessionUser, `grep -q "brew shellenv" ~/.bash_profile || echo '${setupCmd}' >> ~/.bash_profile`);
    
    // 3. Update brew
    await runAsUser(sessionUser, '$HOME/homebrew/bin/brew update');
  },

  /**
   * Installs packages using the isolated brew.
   */
  installPackages: async (instanceName: string, packages: string[]): Promise<void> => {
    if (packages.length === 0) return;
    const sessionUser = await getSessionUsername(instanceName);
    const pkgs = packages.join(' ');
    await runAsUser(sessionUser, `$HOME/homebrew/bin/brew install ${pkgs}`);
  }
};
