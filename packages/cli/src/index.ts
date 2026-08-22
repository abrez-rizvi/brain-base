#!/usr/bin/env node

import { Command } from 'commander';
import { handleInit } from './commands/init.js';
import { handleSync } from './commands/sync.js';
import { handleStatus } from './commands/status.js';
import { handleDiff } from './commands/diff.js';
import { handleReset } from './commands/reset.js';
import { handlePush } from './commands/push.js';
import { handlePropose } from './commands/propose.js';
import { handleAuthLogin, handleAuthStatus, handleAuthLogout } from './commands/auth.js';
import { handleKnowledgeList, handleKnowledgeShow } from './commands/knowledge.js';
import { handleSkillsList, handleSkillsShow, handleSkillsInstall } from './commands/skills.js';

const program = new Command();

program
  .name('knowiki')
  .description('Knowiki CLI — Developer Control & Contribution Plane for Shared Project Intelligence')
  .version('1.0.0');

// --- knowiki init ---
program
  .command('init [repoUrl]')
  .description('Connect workspace to a Knowiki source repository and bootstrap agent meta-skill')
  .option('-b, --branch <branch>', 'Target repository branch')
  .option('-y, --yes', 'Non-interactive mode with default choices')
  .option('--no-agent-skill', 'Skip auto-installing the agent meta-skill')
  .option('--api-url <url>', 'Knowiki API endpoint override')
  .option('--json', 'Output result in structured JSON format')
  .action(async (repoUrl, options) => {
    await handleInit(repoUrl, options);
  });

// --- knowiki sync ---
program
  .command('sync')
  .description('Synchronize remote intelligence into local cache')
  .option('-f, --force', 'Force overwrite local uncommitted modifications')
  .option('--json', 'Output result in structured JSON format')
  .action(async (options) => {
    await handleSync(options);
  });

// --- knowiki status ---
program
  .command('status')
  .description('Show current Knowiki workspace connection, cache volume, and uncommitted modifications')
  .option('--json', 'Output status in structured JSON format')
  .action(async (options) => {
    await handleStatus(options);
  });

// --- knowiki diff ---
program
  .command('diff [path]')
  .description('Show unified diff of local uncommitted modifications against remote baseline')
  .option('--json', 'Output diffs in structured JSON format')
  .action(async (path, options) => {
    await handleDiff(path, options);
  });

// --- knowiki reset ---
program
  .command('reset')
  .description('Discard all uncommitted local modifications and reset to remote baseline')
  .option('-y, --yes', 'Skip confirmation prompt')
  .option('--json', 'Output result in structured JSON format')
  .action(async (options) => {
    await handleReset(options);
  });

// --- knowiki push ---
program
  .command('push')
  .description('Directly commit local modifications to remote repository (collaborators with write permission)')
  .option('-m, --message <msg>', 'Commit message')
  .option('-b, --branch <branch>', 'Target branch override')
  .option('-t, --token <token>', 'GitHub Personal Access Token')
  .option('-y, --yes', 'Non-interactive mode')
  .option('--json', 'Output result in structured JSON format')
  .action(async (options) => {
    await handlePush(options);
  });

// --- knowiki propose ---
program
  .command('propose')
  .description('Create a proposal branch and open a GitHub Pull Request for team review')
  .option('--title <title>', 'Pull Request title')
  .option('-m, --message <msg>', 'Pull Request description / commit message')
  .option('-b, --branch <branch>', 'Base branch override')
  .option('-t, --token <token>', 'GitHub Personal Access Token')
  .option('-y, --yes', 'Non-interactive mode')
  .option('--json', 'Output result in structured JSON format')
  .action(async (options) => {
    await handlePropose(options);
  });

// --- knowiki auth ---
const authCmd = program.command('auth').description('Manage GitHub authentication and tokens');

authCmd
  .command('login')
  .description('Authenticate with GitHub via PAT or GitHub CLI')
  .option('-t, --token <token>', 'GitHub Personal Access Token')
  .option('--use-gh', 'Use active GitHub CLI token directly')
  .option('--json', 'Output result in structured JSON format')
  .action(async (options) => {
    await handleAuthLogin(options);
  });

authCmd
  .command('status')
  .description('Check current GitHub authentication status and repository access level')
  .option('--json', 'Output result in structured JSON format')
  .action(async (options) => {
    await handleAuthStatus(options);
  });

authCmd
  .command('logout')
  .description('Clear stored GitHub authentication credentials')
  .option('--json', 'Output result in structured JSON format')
  .action(async (options) => {
    await handleAuthLogout(options);
  });

// --- knowiki knowledge ---
const knowledgeCmd = program.command('knowledge').description('Inspect and browse project knowledge documents');

knowledgeCmd
  .command('list')
  .description('List all cached knowledge documents')
  .option('--json', 'Output list in structured JSON format')
  .action(async (options) => {
    await handleKnowledgeList(options);
  });

knowledgeCmd
  .command('show <path>')
  .description('Display content of a knowledge document')
  .option('--json', 'Output document in structured JSON format')
  .action(async (path, options) => {
    await handleKnowledgeShow(path, options);
  });

// --- knowiki skills ---
const skillsCmd = program.command('skills').description('Manage and materialize project skills & runbooks');

skillsCmd
  .command('list')
  .description('List all available project skills')
  .option('--json', 'Output skills in structured JSON format')
  .action(async (options) => {
    await handleSkillsList(options);
  });

skillsCmd
  .command('show <skill-id>')
  .description('Display a skill runbook in the terminal')
  .option('--json', 'Output skill in structured JSON format')
  .action(async (skillId, options) => {
    await handleSkillsShow(skillId, options);
  });

skillsCmd
  .command('install <skill-id>')
  .description('Materialize canonical skill into agent-native directories (.gemini/, .cursor/, .claude/)')
  .option('-t, --target <agent>', 'Target agent environment (gemini, cursor, claude, auto)')
  .option('-g, --global', 'Install into user global directory rather than workspace')
  .option('-y, --yes', 'Non-interactive mode')
  .option('--json', 'Output result in structured JSON format')
  .action(async (skillId, options) => {
    await handleSkillsInstall(skillId, options);
  });

program.parse(process.argv);
