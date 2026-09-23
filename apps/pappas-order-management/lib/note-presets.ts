const noteLines = (note: string) => note
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

export function hasNotePreset(note: string, preset: string): boolean {
  const normalizedPreset = preset.trim();
  return normalizedPreset.length > 0 && noteLines(note).includes(normalizedPreset);
}

export function toggleNotePreset(note: string, preset: string): string {
  const normalizedPreset = preset.trim();
  if (!normalizedPreset) return note.trim();

  const nextLines = noteLines(note);
  const presetIndex = nextLines.indexOf(normalizedPreset);
  if (presetIndex >= 0) nextLines.splice(presetIndex, 1);
  else nextLines.push(normalizedPreset);
  return nextLines.join('\n');
}
