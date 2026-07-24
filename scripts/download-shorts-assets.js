const { existsSync, mkdirSync } = require('fs');
const { spawnSync } = require('child_process');
const { join } = require('path');

const root = join(__dirname, '..');
const destination = join(root, 'assets', 'shorts');
const ytDlpCandidates = [
  process.env.YT_DLP_PATH,
  'C:\\Users\\hendr\\Downloads\\yt-dlp.exe',
  'yt-dlp',
].filter(Boolean);
const ytDlp = ytDlpCandidates.find((candidate) =>
  candidate === 'yt-dlp' || existsSync(candidate));

if (!ytDlp) {
  console.error('yt-dlp is required to download the Shorts assets.');
  console.error('Install yt-dlp or set YT_DLP_PATH to its executable.');
  process.exit(1);
}

mkdirSync(destination, { recursive: true });

const videos = [
  {
    file: 'eRXE8Aebp7s.mp4',
    url: 'https://www.youtube.com/watch?v=eRXE8Aebp7s',
    extraArgs: ['--download-sections', '*00:00:00-01:00:00'],
  },
  {
    file: 'J9dvPQuHz-I.mp4',
    url: 'https://www.youtube.com/watch?v=J9dvPQuHz-I',
    extraArgs: [],
  },
];

for (const video of videos) {
  const output = join(destination, video.file);
  if (existsSync(output)) continue;
  const result = spawnSync(ytDlp, [
    '--no-playlist',
    '--format', '18',
    ...video.extraArgs,
    '--output', output,
    video.url,
  ], { stdio: 'inherit', shell: false });
  if (result.status !== 0) process.exit(result.status || 1);
}
