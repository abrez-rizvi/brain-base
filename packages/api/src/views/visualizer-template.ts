import fs from 'node:fs';
import path from 'node:path';

function findHtmlFile(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'packages/api/src/views/visualizer.html'),
    path.resolve(process.cwd(), 'src/views/visualizer.html'),
    path.resolve(process.cwd(), 'views/visualizer.html'),
    path.resolve(process.cwd(), 'dist/views/visualizer.html'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, 'utf8');
    }
  }
  return null;
}

let cachedHtml: string | null = null;

export function getVisualizerHtml(): string {
  if (!cachedHtml) {
    cachedHtml = findHtmlFile();
    if (!cachedHtml) {
      cachedHtml = `<!DOCTYPE html>
<html>
<head><title>Ever-Brain Visualizer</title></head>
<body style="background:#090d13;color:#e6edf3;font-family:sans-serif;padding:40px;">
  <h2>Ever-Brain Live Visualizer</h2>
  <p>Status: Active | Endpoint: <code>/ui/state</code> | Stream: <code>/ui/events</code></p>
</body>
</html>`;
    }
  }
  return cachedHtml;
}
