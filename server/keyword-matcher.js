// server/keyword-matcher.js

// 全角・半角と大文字・小文字の違いをなくす。ひらがなとカタカナは区別する。
export function normalizeForMatch(text) {
  return text.normalize("NFKC").toLowerCase();
}

// body に含まれる（部分一致する）キーワードを、登録順に返す。
export function findMatchedKeywords(keywords, body) {
  const normalizedBody = normalizeForMatch(body);
  return keywords.filter((keyword) => normalizedBody.includes(normalizeForMatch(keyword)));
}
