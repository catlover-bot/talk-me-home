import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PHRASES, proposalLabelForRequest } from './qa-mission-player.mjs';
import { proposalRecoveryPhrases } from './qa-player-policy.mjs';
import { LOCATION_REQUESTS, passageRequests } from './qa-player-recovery.mjs';
import { DEFAULT_MEDIA_DIRECTORY, validateSpeechWav } from './qa-speech-fixtures.mjs';

const directions = ['east', 'west', 'northeast', 'northwest', 'southeast', 'southwest'];
const actionRequests = [PHRASES.engage, PHRASES.contact, PHRASES.release, PHRASES.board, PHRASES.home, 'Please cross to the far side.',
  ...directions.map(direction => `Please go through the ${direction} gate.`),
  ...['Neutral', 'Anchor', 'Bridge'].map(selector => `Please set the selector to ${selector}.`)];
const labels = actionRequests.map(proposalLabelForRequest);
if (labels.some(label => !label)) throw new Error('A delivered action request has no visible label.');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const speechFixtureId = text => 'speech-' + digest(text).slice(0, 16);

/** The delivered player's existing finite utterances, prepared before freezing. */
export function playerSpeechTexts() {
  const texts = [...Object.values(PHRASES), ...LOCATION_REQUESTS.map(request => request.text), 'Please cross to the far side.', 'Please cross to the far side now if the route is clear.', 'Please look around and report the objects you can reach from the platform.'];
  for (const direction of directions) {
    texts.push(...passageRequests(direction).map(request => request.text));
    texts.push(`Please inspect the ${direction} gate and tell me whether anything blocks it.`, `Please go through the ${direction} gate, then look around and report the emblem where you arrive.`, `Please go through the ${direction} gate.`, `Is the opening of the ${direction} gate physically clear or blocked?`, `Please check the ${direction} gate again and report whether cargo blocks passage.`);
  }
  // Cover every finite label pair, without predicting a route or reading state.
  // No retained receipt is also legitimate. The shared helper supplies exact text.
  for (const expectedLabel of labels) {
    for (const currentLabel of [null, ...labels]) {
      const phrases = proposalRecoveryPhrases(expectedLabel, currentLabel ? { label: currentLabel, status: 'committed' } : null);
      texts.push(phrases.clarify, phrases.retry, phrases.propose);
    }
  }
  return [...new Set(texts)];
}

/** Once frozen, speech is read-only: neither an absent file nor a changed byte is repaired. */
export async function readFrozenSpeechFixture(text, fixtureFiles, directory = DEFAULT_MEDIA_DIRECTORY) {
  const id = speechFixtureId(text); const metadataName = `${id}.json`; const audioName = `${id}.wav`;
  if (!fixtureFiles?.[metadataName] || !fixtureFiles?.[audioName]) throw new Error('The requested utterance is absent from the frozen speech catalog.');
  const [metadataBytes, audioBytes] = await Promise.all([readFile(join(directory, metadataName)), readFile(join(directory, audioName))]);
  if (digest(metadataBytes) !== fixtureFiles[metadataName] || digest(audioBytes) !== fixtureFiles[audioName]) throw new Error('Frozen speech fixture bytes changed; no replacement was generated.');
  const metadata = JSON.parse(metadataBytes.toString('utf8'));
  if (metadata.id !== id || metadata.text !== text) throw new Error('Frozen speech metadata does not match the intended utterance.');
  return { ...metadata, ...validateSpeechWav(audioBytes), path: join(directory, audioName) };
}

export async function validateFrozenPlayerSpeech(fixtureFiles, directory = DEFAULT_MEDIA_DIRECTORY) {
  for (const text of playerSpeechTexts()) await readFrozenSpeechFixture(text, fixtureFiles, directory);
}
