// Build a structured "Interviewer / SME" transcript from Ailean conversation turns.
export function buildStructuredTranscript(turns, currentDraft) {
  const parts = turns.map(turn =>
    turn.type === 'ailean'
      ? `Interviewer: ${turn.text}`
      : `SME: ${turn.text}`
  );
  if (currentDraft?.trim()) {
    parts.push(`SME: ${currentDraft.trim()}`);
  }
  return parts.join('\n\n');
}
