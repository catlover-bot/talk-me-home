// QA player parsing uses communicated prose and caller-supplied visible map labels only.
// Ambiguity requests a clarification; these helpers never read game state or tool payloads.
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function communicatedEmblem(text, visibleNames) {
  if (typeof text !== 'string' || !Array.isArray(visibleNames)) return null;
  const sentences = text.toLowerCase().split(/[.!?;\n]+/).map(value => value.trim()).filter(Boolean);
  const names = [...new Set(visibleNames.map(name => String(name).toLowerCase()))];
  const candidates = new Set();
  for (const sentence of sentences) {
    if (/\b(?:if|would|could|will|was|were|previous|earlier|left|leave|toward|heading|not|isn't|maybe|might|unsure|uncertain|cancelled|canceled|failed)\b/.test(sentence)) continue;
    for (const name of names) {
      const literal = escape(name);
      const bare = new RegExp(`^(?:(?:it(?: is|'s)|it looks like|the (?:current )?emblem is) )?(?:a |the )?${literal}(?:[- ]shaped)?(?: (?:emblem|symbol|mark))?$`);
      const emblem = new RegExp(`\\b${literal}(?:[- ]shaped)? (?:emblem|symbol|mark)\\b|\\b(?:emblem|symbol|mark) (?:is|looks like) (?:a |the )?${literal}\\b`);
      const position = new RegExp(`\\b(?:at|by|reached|arrived at) (?:the |a )?${literal}\\b|\\bnow (?:at )?${literal}\\b`);
      if (bare.test(sentence) || emblem.test(sentence) || position.test(sentence)) candidates.add(name);
    }
  }
  return candidates.size === 1 ? [...candidates][0] : null;
}

export function communicatedPassability(text) {
  if (typeof text !== 'string') return null;
  const value = text.toLowerCase().replaceAll('\u2019', "'");
  if (/\b(?:unsure|uncertain|maybe|might|will|would|could|if|cancelled|canceled|failed)\b|\b(?:can't|cannot|don't|do not) (?:tell|see|confirm|know)\b/.test(value)) return null;
  // Remove explicit negations before looking for a positive obstruction report.
  const negatives = /\b(?:not|isn't|is not|wasn't|was not)\s+(?:physically\s+)?(?:blocked|obstructed)\b|\b(?:nothing|no cargo|no debris|no obstruction)\b.{0,20}?\bblock(?:s|ing)?\b|\b(?:no|without)\s+(?:visible\s+|physical\s+)?(?:obstructions?|blockage|cargo|debris)\b/g;
  const clear = negatives.test(value) || /\b(?:clear|unblocked|unobstructed|passable)\b/.test(value) && !/\b(?:not|isn't)\s+(?:a\s+)?(?:clear|unblocked|unobstructed|passable)\b/.test(value);
  negatives.lastIndex = 0;
  const positive = value.replace(negatives, ' ');
  const blocked = /\b(?:blocked|obstructed|impassable|blockage|obstruction)\b|\b(?:cargo|debris)\b.{0,30}\bblock(?:s|ing)?\b/.test(positive);
  if (clear === blocked) return null;
  return clear ? 'clear' : 'blocked';
}

/** Present/committed public prose only. Future promises and uncertain outcomes fail closed. */
export function communicatedAction(text, action) {
  if (typeof text !== 'string') return null;
  const value = text.toLowerCase().replaceAll('\u2019', "'");
  if (/\b(?:will|would|could|might|maybe|unsure|uncertain|try|trying|if|think|thought|assume|guess|seems|earlier|previously|was|had)\b|\b(?:can't|cannot) (?:confirm|tell|know)\b/.test(value)) return null;
  const vocabulary = action === 'latch' ? '(?:engaged|latched|secured|set)' : '(?:holding|held|gripped|secured)';
  const subject = action === 'latch' ? '(?:the )?latch' : '(?:the )?contact';
  if (new RegExp(`\\b(?:not|isn't|is not|is not yet|haven't|have not|have not yet|wasn't|was not)\\s+${vocabulary}\\b`).test(value) || new RegExp(`\\b(?:cannot|can't) (?:engage|hold)\\b`).test(value)) return 'not_done';
  if (/\b(?:cancelled|canceled|failed|interrupted)\b/.test(value)) return null;
  const completed = action === 'latch'
    ? new RegExp(`\\b(?:engaged|latched|secured) (?:the )?latch\\b|\\b${subject} (?:is|has been) (?:now |already )?${vocabulary}\\b|^${subject} (?:now )?${vocabulary}[.!]?$|^${vocabulary}[.!]?$`)
    : new RegExp(`\\b(?:i am|i'm) (?:now )?holding (?:the )?contact\\b|\\b(?:i have|i've) (?:gripped|held) (?:the )?contact\\b|\\b${subject} (?:is|has been) (?:now )?(?:held|secured)\\b|^holding (?:the )?contact(?: steady)?[.!]?$|^${subject} (?:held|secured)[.!]?$`);
  return completed.test(value) ? 'done' : null;
}

export async function confirmedAction({ say, request, clarify, retry, action, checkpoint = async () => false }) {
  if (await checkpoint()) return true;
  let result = communicatedAction(await say(request), action);
  if (await checkpoint() || result === 'done') return true;
  result = communicatedAction(await say(clarify), action);
  if (await checkpoint() || result === 'done') return true;
  // Never repeat a physical action whose commit outcome remains ambiguous.
  if (result !== 'not_done') return false;
  result = communicatedAction(await say(retry), action);
  return Boolean(await checkpoint()) || result === 'done';
}

/** Recover the observed canceled Cargo scan using public checkpoint checks only. */
export async function crossCargoWithRecovery({ say, atGallery }) {
  if (await atGallery()) return true;
  await say('Please cross to the far side.');
  if (await atGallery()) return true;
  const observation = await say('Please look around.');
  if (await atGallery()) return true;
  // A canceled scan or unclear opening cannot justify another movement request.
  const physicalClear = communicatedPassability(String(observation)) === 'clear'
    || /\bdoor\b.{0,25}\b(?:held|open)\b/i.test(String(observation)) && /\bconveyor\b.{0,25}\b(?:stopped|off|still|stationary)\b/i.test(String(observation)) && !/\b(?:not|cannot|can't|cancelled|canceled|failed|might|will)\b/i.test(String(observation));
  if (!physicalClear) return false;
  await say('Please cross to the far side now if the route is clear.');
  return Boolean(await atGallery());
}
