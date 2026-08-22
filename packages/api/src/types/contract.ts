export interface RepoMetadata {
  owner: string;
  repo: string;
  defaultBranch: string;
  description?: string;
}

export interface FileInfo {
  path: string;
  type: 'file';
  sizeBytes: number;
  mimeType: string;
}

export interface FilesResponse {
  repository: string;
  branch: string;
  totalFiles: number;
  files: FileInfo[];
}

export interface SearchMatch {
  path: string;
  matches: number;
  lines?: number[];
}

export interface SearchResponse {
  query: string;
  totalMatches: number;
  results: SearchMatch[];
}

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

export interface HealthResponse {
  status: 'ok';
  version: string;
  uptimeSeconds: number;
  timestamp: string;
}
