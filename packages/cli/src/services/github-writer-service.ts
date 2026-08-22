export interface FileChange {
  path: string;
  content: string | null; // null indicates deletion
}

export interface DirectCommitResult {
  commitSha: string;
  branch: string;
  commitUrl: string;
}

export interface ProposalResult {
  pullRequestUrl: string;
  pullRequestNumber: number;
  branch: string;
  commitSha: string;
  isFork: boolean;
}

export class GitHubWriterService {
  private getHeaders(token: string): Record<string, string> {
    return {
      'User-Agent': 'Knowiki-CLI/1.0',
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async getLatestCommitSha(
    owner: string,
    repo: string,
    branch: string,
    token: string
  ): Promise<{ commitSha: string; treeSha: string }> {
    const refUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}`;
    const refRes = await fetch(refUrl, { headers: this.getHeaders(token) });

    if (!refRes.ok) {
      throw new Error(`Failed to resolve branch '${branch}' in ${owner}/${repo} (${refRes.status})`);
    }

    const refData = (await refRes.json()) as { object: { sha: string } };
    const commitSha = refData.object.sha;

    const commitUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${commitSha}`;
    const commitRes = await fetch(commitUrl, { headers: this.getHeaders(token) });
    if (!commitRes.ok) {
      throw new Error(`Failed to fetch commit object ${commitSha} (${commitRes.status})`);
    }

    const commitData = (await commitRes.json()) as { tree: { sha: string } };
    return { commitSha, treeSha: commitData.tree.sha };
  }

  async createDirectCommit(
    owner: string,
    repo: string,
    branch: string,
    changes: FileChange[],
    message: string,
    token: string
  ): Promise<DirectCommitResult> {
    const { commitSha, treeSha } = await this.getLatestCommitSha(owner, repo, branch, token);

    // 1. Build Git tree payload
    const treePayload = changes.map((c) => {
      if (c.content === null) {
        return {
          path: c.path,
          mode: '100644',
          type: 'blob',
          sha: null,
        };
      }
      return {
        path: c.path,
        mode: '100644',
        type: 'blob',
        content: c.content,
      };
    });

    const createTreeUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees`;
    const treeRes = await fetch(createTreeUrl, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({
        base_tree: treeSha,
        tree: treePayload,
      }),
    });

    if (!treeRes.ok) {
      const err = await treeRes.text();
      throw new Error(`Failed to create Git tree on ${owner}/${repo} (${treeRes.status}): ${err}`);
    }

    const newTreeData = (await treeRes.json()) as { sha: string };
    const newTreeSha = newTreeData.sha;

    // 2. Create commit
    const createCommitUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits`;
    const newCommitRes = await fetch(createCommitUrl, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({
        message,
        tree: newTreeSha,
        parents: [commitSha],
      }),
    });

    if (!newCommitRes.ok) {
      const err = await newCommitRes.text();
      throw new Error(`Failed to create commit on ${owner}/${repo} (${newCommitRes.status}): ${err}`);
    }

    const newCommitData = (await newCommitRes.json()) as { sha: string; html_url?: string };
    const newCommitSha = newCommitData.sha;

    // 3. Update branch ref
    const updateRefUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${encodeURIComponent(branch)}`;
    const updateRefRes = await fetch(updateRefUrl, {
      method: 'PATCH',
      headers: this.getHeaders(token),
      body: JSON.stringify({
        sha: newCommitSha,
      }),
    });

    if (!updateRefRes.ok) {
      const err = await updateRefRes.text();
      throw new Error(`Failed to update branch ref '${branch}' (${updateRefRes.status}): ${err}`);
    }

    return {
      commitSha: newCommitSha,
      branch,
      commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommitSha}`,
    };
  }

  async createProposalPullRequest(
    owner: string,
    repo: string,
    baseBranch: string,
    changes: FileChange[],
    title: string,
    message: string,
    token: string,
    username: string
  ): Promise<ProposalResult> {
    const { commitSha, treeSha } = await this.getLatestCommitSha(owner, repo, baseBranch, token);

    // Create unique proposal branch name
    const timestamp = Date.now();
    const branchName = `knowiki/proposal-${timestamp}`;

    // 1. Create the proposal branch ref pointing to baseBranch HEAD
    const createRefUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`;
    const createRefRes = await fetch(createRefUrl, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: commitSha,
      }),
    });

    let targetOwner = owner;
    let isFork = false;

    // If 403 or 404 on upstream ref creation, user might need a fork
    if (!createRefRes.ok && (createRefRes.status === 403 || createRefRes.status === 404)) {
      // Fork repository
      const forkUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/forks`;
      await fetch(forkUrl, {
        method: 'POST',
        headers: this.getHeaders(token),
      });

      targetOwner = username;
      isFork = true;

      // Wait a moment for fork replication
      await new Promise((r) => setTimeout(r, 2000));

      const forkRefUrl = `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo)}/git/refs`;
      await fetch(forkRefUrl, {
        method: 'POST',
        headers: this.getHeaders(token),
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: commitSha,
        }),
      });
    }

    // 2. Commit changes to the proposal branch
    const commitResult = await this.createDirectCommit(
      targetOwner,
      repo,
      branchName,
      changes,
      message,
      token
    );

    // 3. Open Pull Request on upstream repository
    const prUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`;
    const headRef = isFork ? `${username}:${branchName}` : branchName;

    const prRes = await fetch(prUrl, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({
        title: title || message.split('\n')[0] || 'Knowiki Intelligence Update',
        head: headRef,
        base: baseBranch,
        body: message,
      }),
    });

    if (!prRes.ok) {
      const err = await prRes.text();
      throw new Error(`Failed to open Pull Request on ${owner}/${repo} (${prRes.status}): ${err}`);
    }

    const prData = (await prRes.json()) as { html_url: string; number: number };

    return {
      pullRequestUrl: prData.html_url,
      pullRequestNumber: prData.number,
      branch: branchName,
      commitSha: commitResult.commitSha,
      isFork,
    };
  }
}

export const githubWriterService = new GitHubWriterService();
