// QA claims interpret bounded communicated prose, never authoritative physical truth.
// Only caller-supplied visible map labels and the requested direction provide context.
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalize = text => text.toLowerCase().replaceAll('\u2019', "'");
const uncertainty = /\b(?:will|would|could|may|might|maybe|unsure|uncertain|try|trying|think|thought|assume|guess|seems|appears|perhaps|earlier|previously|was|were|had|cancelled|canceled|interrupted|doubt|false|untrue)\b|\b(?:can't|cannot|don't|do not) (?:confirm|tell|know|verify|see)\b|\b(?:have not|haven't) (?:checked|verified|confirmed)\b|\b(?:did not|didn't) say\b/;
const attribution = /["“”]|'[^']*\b(?:latch|contact|gate|emblem)\b[^']*'|\b(?:you said|you told|your (?:claim|report)|according to|the (?:manual|diagram|plate) says)\b/;
const directions = /\b(?:north(?:[- ]?east|[- ]?west)?|south(?:[- ]?east|[- ]?west)?|east|west)\b/g;
const directionOf = text => [...new Set((text.match(directions) ?? []).map(value => value.replace(/[- ]/g, '')))];

// Conditions and attribution govern their sentence. Other uncertainty belongs to
// its clause, so a later movement question cannot negate a declarative Latch report.
function clauses(text) {
  if (typeof text !== 'string') return [];
  return (normalize(text).match(/[^.!?;\n]+[.!?;]?/g) ?? []).flatMap(sentence => {
    const question = /\?\s*$/.test(sentence);
    const leadingCondition = /^\s*(?:if|unless)\b/.test(sentence);
    return sentence.replace(/[.!?;]+$/, '').split(/,?\s+but\s+|,?\s+and\s+(?=(?:i\b|i'm\b|i've\b|the\b|you\b|it\b|we\b))|,\s+(?=(?:now|here|this room)\b)/)
      .map(value => ({ value: value.trim().replace(/^(?:actually|however|instead),?\s+/, ''), conditional: leadingCondition || /\b(?:if|unless|whether)\b/.test(value), quoted: attribution.test(value), question }));
  });
}

function combine(values, mentioned, invalid) {
  const distinct = new Set(values);
  return { mentioned, value: !invalid && distinct.size === 1 ? [...distinct][0] : null };
}

/** Relevant unknowns invalidate memory without erasing unrelated subjects. */
export function communicatedActionClaim(text, action) {
  if (!['latch', 'contact', 'crossing'].includes(action)) return { mentioned: false, value: null };
  const values = []; let mentioned = false; let invalid = false; let topic = null; let transition = false;
  for (const clause of clauses(text)) {
    const value = clause.value;
    const explicit = /\blatch\b/.test(value) ? 'latch' : /\bcontact\b/.test(value) ? 'contact' : /\b(?:cross|crossed|crossing)\b/.test(value) ? 'crossing' : null;
    if (explicit) topic = explicit;
    else if (/\b(?:conveyor|door|energy|charge|charging|gate|passage|emblem)\b/.test(value)) topic = 'other';
    const referent = /\b(?:it|that)\b/.test(value) || /^(?:i )?(?:can't|cannot) confirm\b|^(?:not |isn't |failed\b)/.test(value);
    if (explicit !== action && !(referent && topic === action)) continue;
    // Questions, conditions, quotations and promises supply no independent result.
    // They therefore cannot replace an already retained declarative report.
    if (clause.question || clause.conditional || clause.quoted || /\b(?:i|we) (?:will|shall|plan to|intend to|am going to)\b/.test(value)
      || /\b(?:propos(?:e|ed|al)|awaiting confirmation|pending (?:your )?confirmation|not executed)\b/.test(value)) continue;
    mentioned = true;
    if (uncertainty.test(value)) {
      if (!/\b(?:will|would|could|try|trying)\b/.test(value) || /\b(?:cannot|can't) confirm\b/.test(value)) invalid = true;
      continue;
    }
    let negative = false; let positive = false;
    if (action === 'latch') {
      negative = /\b(?:not|isn't|haven't|hasn't)\s+(?:yet\s+)?(?:engaged|latched|secured|set)\b|\b(?:can't|cannot) engage\b|\b(?:did not|didn't|does not|doesn't) (?:catch|engage|latch)\b|\b(?:failed to|unable to) engage\b|\b(?:disengaged|unlatched)\b/.test(value);
      positive = /\b(?:engaged|latched|secured|set) (?:the )?latch\b|\blatch (?:is |has been )?(?:now |already )?(?:engaged|latched|secured|set)\b/.test(value);
    } else if (action === 'contact') {
      negative = /\b(?:not|isn't|haven't|hasn't|no longer)\s+(?:yet\s+)?(?:holding|held|gripped|secured)\b|\b(?:can't|cannot) hold\b|\b(?:released|let go of) (?:the )?contact\b|\bcontact (?:is )?(?:released|not held)\b/.test(value);
      positive = /\b(?:i am|i'm) (?:now |still )?holding (?:the )?contact\b|\b(?:i have|i've) (?:gripped|held|secured) (?:the )?contact\b|\bcontact (?:is |has been )?(?:now |still )?(?:held|secured)\b|^holding (?:the )?contact(?: steady)?$/.test(value);
    } else {
      negative = /\b(?:not|haven't)\s+(?:yet\s+)?crossed\b|\b(?:can't|cannot) cross\b/.test(value);
      positive = /\b(?:i have|i've|i) (?:now |already )?crossed\b/.test(value);
    }
    if (negative) values.push('not_done');
    else if (positive && !/\b(?:tried|attempted|failed)\b/.test(value)) {
      values.push('reported_done');
      if (/\b(?:i have|i've|i) (?:now |already )?(?:engaged|latched|secured|gripped|held|crossed)\b/.test(value)) transition = true;
    }
    else if (/\b(?:cannot|can't|not|failed|unsure|uncertain)\b/.test(value)) invalid = true;
  }
  const claim = combine(values, mentioned, invalid);
  return { ...claim, transition: claim.value === 'reported_done' && transition };
}

export function communicatedAction(text, action) {
  return communicatedActionClaim(text, action).value;
}

/** Open relay gates do not establish physical passage clearance. */
export function communicatedPassabilityClaim(text, target) {
  const requested = typeof target === 'string' ? directionOf(normalize(target)) : [];
  if (target !== undefined && requested.length !== 1) return { mentioned: false, value: null };
  const targetDirection = requested[0];
  const values = []; const scope = new Set(); let mentioned = false; let invalid = false; let previousDirection; let previousPassage = false;
  for (const clause of clauses(text)) {
    const value = clause.value;
    const named = directionOf(value);
    if (named.length) previousDirection = named.length === 1 ? named[0] : undefined;
    const direction = named[0] ?? (/\bit\b/.test(value) ? previousDirection : undefined);
    const relevant = /\b(?:clear|unblocked|unobstructed|passable|blocked|obstructed|impassable|blockage|obstruction|obstructions|blocks|blocking)\b/.test(value);
    if (!relevant) {
      if (previousPassage && /\b(?:can't|cannot) confirm (?:that|it)\b/.test(value) && (!targetDirection || !previousDirection || previousDirection === targetDirection)) { mentioned = true; invalid = true; }
      if (/\b(?:scan|inspection)\b.{0,30}\b(?:canceled|cancelled|failed)\b/.test(value) && (!named.length || !targetDirection || named.includes(targetDirection))) invalid = true;
      if (/\b(?:latch|contact|conveyor|emblem|energy)\b/.test(value)) previousPassage = false;
      continue;
    }
    previousPassage = true;
    if (targetDirection && direction && direction !== targetDirection) continue;
    if (targetDirection && /\b(?:another|other) (?:gate|passage|opening)\b/.test(value)) { invalid = true; continue; }
    if (clause.question || clause.conditional || clause.quoted) continue;
    mentioned = true;
    if (named.length > 1 || uncertainty.test(value)) { invalid = true; continue; }
    if (direction) scope.add(direction);
    if (/\b(?:not|isn't|is not) (?:clear|unblocked|unobstructed|passable)\b/.test(value)) { invalid = true; continue; }
    const negatives = /\b(?:not|isn't|is not)\s+(?:physically\s+)?(?:blocked|obstructed)\b|\b(?:nothing|no cargo|no debris|no obstruction)\b.{0,20}?\bblock(?:s|ing)?\b|\b(?:no|without)\s+(?:visible\s+|physical\s+)?(?:obstructions?|blockage|cargo|debris)\b/g;
    const clear = negatives.test(value) || /\b(?:clear|unblocked|unobstructed|passable)\b/.test(value);
    negatives.lastIndex = 0;
    const remaining = value.replace(negatives, ' ');
    const blocked = /\b(?:blocked|obstructed|impassable|blockage|obstruction)\b|\b(?:cargo|debris)\b.{0,30}\bblock(?:s|ing)?\b/.test(remaining);
    if (clear === blocked) invalid = true;
    else values.push(clear ? 'clear' : 'blocked');
  }
  return combine(values, mentioned, invalid || !targetDirection && scope.size > 1);
}

export function communicatedPassability(text, target) {
  return communicatedPassabilityClaim(text, target).value;
}

export function communicatedEmblemClaim(text, visibleNames) {
  if (typeof text !== 'string' || !Array.isArray(visibleNames)) return { mentioned: false, value: null };
  const names = [...new Set(visibleNames.map(name => String(name).toLowerCase()))];
  const candidates = new Set(); let uncertain = false; let locationTopic = false; let mentioned = false;
  for (const clause of clauses(text)) {
    // Synonyms remain communicated shape descriptions matched to the visible atlas.
    const value = clause.value.replace(/\b(?:circle|circular|annular)(?:[- ]shaped)? (emblem|symbol|mark)\b/g, 'ring $1')
      .replace(/\b(?:y-shaped|branching|three-pronged) (emblem|symbol|mark)\b/g, 'fork $1')
      .replace(/\b(?:sailboat|sail-shaped) (emblem|symbol|mark)\b/g, 'sail $1');
    const labels = names.filter(name => new RegExp(`\\b${escape(name)}\\b`).test(value));
    if (labels.length || /\bemblem\b/.test(value)) locationTopic = true;
    else if (/\b(?:latch|contact|conveyor|energy|gate|passage)\b/.test(value)) locationTopic = false;
    if (clause.question || clause.conditional || clause.quoted || /\b(?:will|would|could|earlier|previously|was|were|had|left|leave|toward|heading|beyond|next|ahead)\b/.test(value)) continue;
    const locationReport = /\b(?:emblem|my location|where i am)\b/.test(value)
      || labels.length > 0 && /\b(?:i am|i'm|i might be|i may be|now|reached|arrived|not at)\b/.test(value);
    if (locationReport) mentioned = true;
    if (locationTopic && /\b(?:can't|cannot) confirm (?:that|it)\b/.test(value)) { mentioned = true; uncertain = true; }
    if (locationReport && labels.length > 1) uncertain = true;
    if (uncertainty.test(value) || /\b(?:not|isn't)\b/.test(value)) {
      if (locationReport) uncertain = true;
      continue;
    }
    for (const name of names) {
      const literal = escape(name);
      const bare = new RegExp(`^(?:(?:it(?: is|'s)|it looks like|the (?:current )?emblem is) )?(?:a |the )?${literal}(?:[- ]shaped)?(?: (?:emblem|symbol|mark))?$`);
      const emblem = new RegExp(`\\b${literal}(?:[- ]shaped)? (?:emblem|symbol|mark)\\b|\\b(?:emblem|symbol|mark) (?:is|looks like) (?:a |the )?${literal}\\b`);
      const position = new RegExp(`\\b(?:i am|i'm|i am now|i'm now) (?:at|by) (?:the |a )?${literal}\\b|\\b(?:reached|arrived at) (?:the |a )?${literal}\\b|\\bnow (?:at )?${literal}\\b`);
      if (bare.test(value) || emblem.test(value) || position.test(value)) { mentioned = true; candidates.add(name); }
    }
  }
  return { mentioned, value: !uncertain && candidates.size === 1 ? [...candidates][0] : null };
}

export function communicatedEmblem(text, visibleNames) {
  return communicatedEmblemClaim(text, visibleNames).value;
}

export async function confirmedAction({ say, request, clarify, retry, action, checkpoint = async () => false }) {
  if (await checkpoint()) return true;
  let result = communicatedAction(await say(request), action);
  if (await checkpoint() || result === 'reported_done') return true;
  result = communicatedAction(await say(clarify), action);
  if (await checkpoint() || result === 'reported_done') return true;
  // Never repeat a physical action whose commit outcome remains ambiguous.
  if (result !== 'not_done') return false;
  result = communicatedAction(await say(retry), action);
  return Boolean(await checkpoint()) || result === 'reported_done';
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
    || /\bdoor\b.{0,25}\b(?:held|open)\b/i.test(String(observation)) && /\bconveyor\b.{0,25}\b(?:stopped|off|stationary)\b/i.test(String(observation)) && !/\b(?:not|cannot|can't|cancelled|canceled|failed|might|will)\b/i.test(String(observation));
  if (!physicalClear) return false;
  await say('Please cross to the far side now if the route is clear.');
  return Boolean(await atGallery());
}

/** Bounded observable classification, never hidden physical-state inference. */
export function classifyProposalResponse({ expectedLabel, before, current, reply = '', terminalIds = [], confirmedIds = [] }) {
  const relevant = /\b(?:check|inspect|status|proposal|confirm|latch|door|conveyor|gate|passage|contact|capsule|return|cross|board)\b/i.test(reply);
  const text = String(reply).replaceAll('\u2019', "'");
  const subject = expectedLabel === 'Engage the Latch' ? 'latch' : /charging contact/.test(expectedLabel) ? 'contact' : expectedLabel === 'Move to the far-side platform' ? 'crossing' : null;
  const claim = subject && communicatedActionClaim(text, subject);
  const completion = expectedLabel === 'Release the charging contact'
    ? claim?.value === 'not_done' && /\b(?:released|let go of) (?:the )?contact\b/i.test(text)
    : claim?.value === 'reported_done' || /\b(?:i (?:have )?(?:already )?(?:successfully )?(?:moved|went|boarded|returned home)|i've (?:moved|boarded)|i am (?:aboard|home))\b/i.test(text) && !/\b(?:not|haven't|didn't|cannot|can't|will|would|could|might)\b/i.test(text);
  // The exact retained boarding receipt proves that past step only. It cannot
  // prove a return, or permit a new boarding proposal during return recovery.
  const knownPastBoarding = expectedLabel === 'Confirm the authorized return'
    && current?.status === 'committed' && current.label === 'Board the recovery capsule' && confirmedIds.includes(current.proposalId)
    && /\b(?:boarded|aboard)\b/i.test(text)
    && !/\b(?:moved|went|crossed|engaged|released|holding|secured|returned|home|departed|launched|confirmed|completed)\b/i.test(text);
  if (current?.status === 'awaiting_confirmation') {
    if (!current.proposalId || terminalIds.includes(current.proposalId) || confirmedIds.includes(current.proposalId)) return { kind: 'stale_pending', relevant };
    if (current.label !== expectedLabel) return { kind: 'wrong_pending', relevant };
    if (completion) return { kind: 'false_completion', relevant };
    return { kind: 'matching_pending', relevant };
  }
  if (current?.status === 'committed' && current.proposalId !== before?.proposalId && !confirmedIds.includes(current.proposalId)) return { kind: 'unconfirmed_commit', relevant };
  if (completion && !knownPastBoarding && !(current?.status === 'committed' && current.label === expectedLabel && confirmedIds.includes(current.proposalId))) return { kind: 'false_completion', relevant };
  if (current && ['declined', 'expired', 'invalidated', 'failed', 'confirming'].includes(current.status)) return { kind: 'rejected_or_unresolved', relevant };
  if (current?.status === 'committed') return { kind: 'verified_committed_receipt', relevant };
  return { kind: relevant ? 'relevant_clarification' : 'no_relevant_reply', relevant };
}

export function proposalRecoveryPhrases(expectedLabel, current) {
  if (expectedLabel === 'Confirm the authorized return') return {
    clarify: 'Please inspect the capsule for its local departure operation and tell me how to confirm the authorized return.',
    retry: 'Please confirm the authorized return using the capsule operation you just inspected. Propose that local interaction for my console confirmation.',
    propose: "Please create one new proposal to confirm the authorized return using the capsule's inspected local operation. I will decide on the console.",
  };
  const receipt = current?.status === 'committed' ? `The console confirms "${current.label}" completed. ` : '';
  const clarify = `${receipt}Please check the relevant proposal result and local conditions needed for "${expectedLabel}".`;
  const fixed = {
    'Engage the Latch': 'Please set the Latch to hold the Door open.',
    'Hold the charging contact': 'Please grip the contact steadily.',
    'Release the charging contact': 'Please let go of the contact.',
    'Move to the far-side platform': 'Please cross to the far side now if the route is clear.',
    'Board the recovery capsule': 'Please board the capsule when it is safe to board.',
    'Confirm the authorized return': 'Please confirm the return under the current authorization.',
  };
  const direction = expectedLabel.match(/^Move through the (east|west|northeast|northwest|southeast|southwest) gate$/)?.[1];
  return { clarify, retry: fixed[expectedLabel] ?? (direction ? `Please go through the ${direction} gate if the opening is clear.` : `Please ${expectedLabel.toLowerCase()} if its local conditions are satisfied.`),
    propose: `Please create one new proposal to ${expectedLabel.toLowerCase()}. I will decide on the console.` };
}
