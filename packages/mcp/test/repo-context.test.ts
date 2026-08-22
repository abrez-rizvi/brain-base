import { describe, it, expect } from 'vitest';
import { parseRepoContext } from '../src/server/repo-context.js';

describe('Repo Context Parser', () => {
  it('parses owner and repo from route params', () => {
    const ctx = parseRepoContext({ owner: 'acme', repo: 'project' });
    expect(ctx).toEqual({ owner: 'acme', repo: 'project' });
  });

  it('parses owner and repo from full GitHub URLs in query param', () => {
    const ctx1 = parseRepoContext(undefined, 'https://github.com/facebook/react');
    expect(ctx1).toEqual({ owner: 'facebook', repo: 'react' });

    const ctx2 = parseRepoContext(undefined, 'http://www.github.com/expressjs/express.git');
    expect(ctx2).toEqual({ owner: 'expressjs', repo: 'express' });
  });

  it('parses shorthand owner/repo from query param', () => {
    const ctx = parseRepoContext(undefined, 'abrez-rizvi/trial-markdown');
    expect(ctx).toEqual({ owner: 'abrez-rizvi', repo: 'trial-markdown' });
  });

  it('strips .git suffix', () => {
    const ctx = parseRepoContext(undefined, 'octocat/Hello-World.git');
    expect(ctx).toEqual({ owner: 'octocat', repo: 'Hello-World' });
  });

  it('returns null when no repo is specified', () => {
    expect(parseRepoContext()).toBeNull();
    expect(parseRepoContext({ owner: '', repo: '' })).toBeNull();
    expect(parseRepoContext(undefined, '')).toBeNull();
  });
});
