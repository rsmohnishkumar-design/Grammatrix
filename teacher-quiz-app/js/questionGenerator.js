// Turns OCR'd page text into multiple-choice questions.
// Purely rule-based (fill-in-the-blank from real sentences) — no external AI call,
// so it works fully offline/client-side with no API key.

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "for",
  "with", "is", "are", "was", "were", "be", "been", "being", "it", "its",
  "this", "that", "these", "those", "as", "by", "from", "into", "over",
  "under", "than", "then", "so", "such", "their", "his", "her", "they",
  "them", "we", "you", "your", "our", "not", "no", "if", "which", "who",
  "whom", "what", "when", "where", "why", "how", "there", "here", "also",
  "can", "will", "would", "should", "could", "may", "might", "must",
]);

function splitIntoSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && s.length < 220 && /[a-zA-Z]/.test(s));
}

function pickKeyword(sentence, usedWords) {
  const words = sentence.match(/[A-Za-z][A-Za-z'-]{3,}/g) || [];
  const candidates = words.filter(
    (w) => !STOPWORDS.has(w.toLowerCase()) && !usedWords.has(w.toLowerCase())
  );
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

function buildDistractors(correct, pool, count) {
  const lowerCorrect = correct.toLowerCase();
  const seen = new Set([lowerCorrect]);
  const options = [];
  for (const w of pool) {
    const lw = w.toLowerCase();
    if (w.length > 3 && !seen.has(lw)) {
      seen.add(lw);
      options.push(w);
    }
  }
  const picked = [];
  while (options.length && picked.length < count) {
    const idx = Math.floor(Math.random() * options.length);
    picked.push(options.splice(idx, 1)[0]);
  }
  return picked;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateQuestions(text, maxQuestions = 8) {
  const sentences = splitIntoSentences(text);
  const allWords = text.match(/[A-Za-z][A-Za-z'-]{3,}/g) || [];
  const usedWords = new Set();
  const questions = [];

  for (const sentence of sentences) {
    if (questions.length >= maxQuestions) break;

    const keyword = pickKeyword(sentence, usedWords);
    if (!keyword) continue;

    const distractors = buildDistractors(keyword, allWords, 2);
    if (distractors.length < 2) continue;

    usedWords.add(keyword.toLowerCase());

    const blanked = sentence.replace(new RegExp(`\\b${keyword}\\b`), "_____");
    const choices = shuffle([keyword, ...distractors]);
    choices.push("I don't know");

    questions.push({
      questionText: blanked,
      options: choices,
      correctAnswer: keyword,
    });
  }

  return questions;
}
