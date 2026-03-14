const BAD_WORDS = [
  'fuck', 'shit', 'ass', 'asshole', 'bitch', 'bastard', 'damn', 'dick',
  'cock', 'cunt', 'pussy', 'piss', 'whore', 'slut', 'fag', 'faggot',
  'nigger', 'nigga', 'retard', 'twat', 'wanker', 'bollocks',
  'motherfucker', 'bullshit', 'horseshit', 'dipshit', 'shithead',
  'dumbass', 'jackass', 'arsehole', 'arse', 'prick', 'skank',
  'douche', 'douchebag', 'spic', 'chink', 'gook', 'kike',
  'tranny', 'homo', 'dyke', 'cracker', 'wetback',
]

/** Check if text contains profanity (whole-word match, case insensitive) */
export function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase()
  return BAD_WORDS.some(w => new RegExp(`\\b${w}\\b`, 'i').test(lower))
}

/** Capitalize first letter of each word */
export function capitalizeName(name: string): string {
  return name.trim().split(/\s+/).map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ')
}
