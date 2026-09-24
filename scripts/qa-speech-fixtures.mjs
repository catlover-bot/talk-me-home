import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

export const DEFAULT_MEDIA_DIRECTORY = resolve('.validation/goal-004b-media');
export const SPEECH_FIXTURES = [
  { id: 'observe', text: 'Pip, please look around and tell me what you can reach.' },
  { id: 'inspect-latch', text: 'Please inspect the Latch and tell me how it works.' },
  { id: 'shared-power', text: 'My manual says the Door and Conveyor share Power. Please tell me what changes when I switch it.' },
  { id: 'correction', text: 'Sorry, I meant the Latch, not the Door. Please inspect the Latch.' },
  { id: 'wait', text: 'Please wait. Do not move or take another action until I ask you to continue.' },
];

export function encodePcmWav(samples, sampleRate = 24_000) {
  const output = Buffer.alloc(44 + samples.length * 2);
  output.write('RIFF'); output.writeUInt32LE(output.length - 8, 4); output.write('WAVEfmt ', 8);
  output.writeUInt32LE(16, 16); output.writeUInt16LE(1, 20); output.writeUInt16LE(1, 22);
  output.writeUInt32LE(sampleRate, 24); output.writeUInt32LE(sampleRate * 2, 28);
  output.writeUInt16LE(2, 32); output.writeUInt16LE(16, 34); output.write('data', 36);
  output.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) output.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i]))), 44 + i * 2);
  return output;
}

export function parsePcmWav(bytes) {
  const buffer = Buffer.from(bytes);
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Expected a RIFF WAVE fixture.');
  let format; let audio;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const kind = buffer.toString('ascii', offset, offset + 4); const size = buffer.readUInt32LE(offset + 4);
    if (offset + 8 + size > buffer.length) throw new Error('Truncated WAVE fixture.');
    if (kind === 'fmt ') {
      if (size < 16) throw new Error('Invalid WAVE format.');
      format = { encoding: buffer.readUInt16LE(offset + 8), channels: buffer.readUInt16LE(offset + 10), sampleRate: buffer.readUInt32LE(offset + 12), bits: buffer.readUInt16LE(offset + 22) };
    }
    if (kind === 'data') audio = buffer.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + size % 2;
  }
  if (!format || !audio || format.encoding !== 1 || format.channels !== 1 || format.bits !== 16 || audio.length % 2) throw new Error('Fixture must be mono signed 16-bit PCM.');
  const samples = new Int16Array(audio.length / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = audio.readInt16LE(i * 2);
  return { ...format, samples };
}

export function validateSpeechWav(bytes) {
  const { samples, sampleRate, channels, bits } = parsePcmWav(bytes);
  if (sampleRate !== 24_000) throw new Error('Speech fixture must use 24 kHz.');
  const durationSeconds = samples.length / sampleRate;
  const energy = samples.reduce((sum, sample) => sum + (sample / 32768) ** 2, 0);
  const nonzeroSamples = samples.reduce((sum, sample) => sum + Number(Math.abs(sample) > 32), 0);
  const cleanStart = samples.subarray(0, 2400).every(sample => sample === 0);
  const cleanEnd = samples.subarray(-4800).every(sample => sample === 0);
  if (durationSeconds < 0.5 || durationSeconds > 40 || nonzeroSamples < 240 || !cleanStart || !cleanEnd) throw new Error('Fixture has invalid duration, silence, or unclean edges.');
  const speechStartSeconds = samples.findIndex(sample => Math.abs(sample) > 32) / sampleRate;
  const speechEndSeconds = (samples.findLastIndex(sample => Math.abs(sample) > 32) + 1) / sampleRate;
  return { sampleRate, channels, bits, durationSeconds, speechStartSeconds, speechEndSeconds, nonzeroSamples, rms: Math.sqrt(energy / samples.length), cleanStart, cleanEnd, sha256: createHash('sha256').update(bytes).digest('hex') };
}

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    const timer = setTimeout(() => { child.kill(); reject(new Error('Local speech synthesis timed out.')); }, 30_000);
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolveRun(stdout.trim()) : reject(new Error(`Local speech synthesis failed (${code}): ${stderr.slice(0, 300)}`)); });
  });
}

/** Offline Windows installed voice only. No physical microphone or network service. */
export async function ensureSpeechFixture({ text, id, directory = DEFAULT_MEDIA_DIRECTORY }) {
  if (typeof text !== 'string' || !text.trim() || text.length > 1200 || !/^[a-z0-9-]{1,100}$/.test(id)) throw new Error('Invalid speech fixture input.');
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, `${id}.wav`); const metadataPath = resolve(directory, `${id}.json`);
  try {
    await access(path);
    const prior = JSON.parse(await readFile(metadataPath, 'utf8'));
    if (prior.text !== text) throw new Error('A speech fixture ID already has different text.');
    return { ...prior, ...validateSpeechWav(await readFile(path)), path };
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = resolve(directory, `${id}.sapi.wav`);
  const windowsPath = process.platform === 'win32' ? temporary : await run('wslpath', ['-w', temporary]);
  const payload = Buffer.from(JSON.stringify({ text, path: windowsPath }), 'utf8').toString('base64');
  const script = `$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$qaInput = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}')) | ConvertFrom-Json
$qaSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $qaVoice = $qaSynth.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -eq 'en-US' } | Select-Object -First 1
  if (-not $qaVoice) { throw 'No offline English speech voice is installed.' }
  $qaSynth.SelectVoice($qaVoice.VoiceInfo.Name)
  $qaSynth.Rate = 0
  $qaFormat = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(24000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  $qaSynth.SetOutputToWaveFile($qaInput.path, $qaFormat)
  $qaSynth.Speak($qaInput.text)
  $qaSynth.SetOutputToNull()
  Write-Output $qaVoice.VoiceInfo.Name
} finally { $qaSynth.Dispose() }`;
  const executable = process.platform === 'win32' ? 'powershell.exe' : '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
  const voice = await run(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')]);
  const raw = parsePcmWav(await readFile(temporary));
  const padded = new Int16Array(4320 + raw.samples.length + 8400); padded.set(raw.samples, 4320);
  const wav = encodePcmWav(padded);
  await writeFile(path, wav, { flag: 'wx' });
  const metadata = { id, text, source: 'Offline Windows System.Speech generic installed English voice; synthetic player speech', voice, ...validateSpeechWav(wav) };
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx' });
  return { ...metadata, path };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_MEDIA_DIRECTORY;
  const fixtures = [];
  for (const fixture of SPEECH_FIXTURES) fixtures.push(await ensureSpeechFixture({ ...fixture, directory }));
  await writeFile(resolve(directory, 'manifest.json'), JSON.stringify({ label: 'AUTOMATED QA — SYNTHETIC PLAYER SPEECH', fixtures: fixtures.map(({ path, ...fixture }) => ({ ...fixture, file: basename(path) })) }, null, 2) + '\n');
  console.log(JSON.stringify({ fixtures: fixtures.length, directory, source: 'Offline Windows System.Speech' }));
}
