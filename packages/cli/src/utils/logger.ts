import pc from 'picocolors';

export const logger = {
  success(message: string): void {
    console.log(`${pc.green('✓')} ${message}`);
  },

  info(message: string): void {
    console.log(`${pc.blue('ℹ')} ${message}`);
  },

  warn(message: string): void {
    console.warn(`${pc.yellow('⚠️')} ${pc.yellow(message)}`);
  },

  error(message: string, details?: unknown): void {
    console.error(`${pc.red('✖')} ${pc.red(message)}`);
    if (details) {
      console.error(details);
    }
  },

  step(step: string, message: string): void {
    console.log(`${pc.cyan(`[${step}]`)} ${message}`);
  },

  highlight(text: string): string {
    return pc.bold(pc.cyan(text));
  },

  dim(text: string): string {
    return pc.dim(text);
  },

  url(text: string): string {
    return pc.underline(pc.cyan(text));
  },
};
