// QA player parsing uses communicated prose and caller-supplied visible map labels only.
// Ambiguity requests a clarification; these helpers never read game state or tool payloads.
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function communicatedEmblem(text, visibleNames) {
  if (typeof text !== 'string' || !Array.isArray(visibleNames)) return null;
  const sentences = text.toLowerCase().split(/[.!?;\n]+/).map(value => value.trim()).filter(Boolean);
  const names = [...new Set(visibleNames.map(name => String(name).toLowerCase()))];
  const candidates = new Set();
  for (const sentence of sentences) {
    if (/\b(?:if|would|could|will|was|were|previous|earlier|left|leave|toward|heading|not|isn't)\b/.test(sentence)) continue;
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
  if (/\b(?:unsure|uncertain|maybe|might)\b|\b(?:can't|cannot|don't|do not) (?:tell|see|confirm|know)\b/.test(value)) return null;
  // Remove explicit negations before looking for a positive obstruction report.
  const negatives = /\b(?:not|isn't|is not|wasn't|was not)\s+(?:physically\s+)?(?:blocked|obstructed)\b|\b(?:nothing|no cargo|no debris|no obstruction)\b.{0,20}?\bblock(?:s|ing)?\b|\b(?:no|without)\s+(?:visible\s+|physical\s+)?(?:obstructions?|blockage|cargo|debris)\b/g;
  const clear = negatives.test(value) || /\b(?:clear|unblocked|unobstructed|passable)\b/.test(value) && !/\b(?:not|isn't)\s+(?:a\s+)?(?:clear|unblocked|unobstructed|passable)\b/.test(value);
  negatives.lastIndex = 0;
  const positive = value.replace(negatives, ' ');
  const blocked = /\b(?:blocked|obstructed|impassable|blockage|obstruction)\b|\b(?:cargo|debris)\b.{0,30}\bblock(?:s|ing)?\b/.test(positive);
  if (clear === blocked) return null;
  return clear ? 'clear' : 'blocked';
}

/** Recover the observed canceled Cargo scan using public checkpoint checks only. */
export async function crossCargoWithRecovery({ say, atGallery }) {
  await say('Power is now off, so please check that the route is safe and then cross to the far side.');
  if (await atGallery()) return true;
  await say('Please look around and tell me whether the Door is held open and the Conveyor has stopped.');
  if (await atGallery()) return true;
  await say('Please cross to the far side now if the route is clear.');
  return Boolean(await atGallery());
}
