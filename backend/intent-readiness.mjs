// A deliberately limited, local check for vague operations without stated rules.
// It reads only the user's intent, never the implementation or function name.
export function intentReadiness(intent) {
  const vague = /\b(normaliz(?:e|es|ed|ing|ation)|normalis(?:e|es|ed|ing|ation)|clean(?:se|ing)?|sanitize|sanitise|format|validate|process)\b|正規化|標準化|清理|格式化|驗證|處理/i.test(intent);
  const rule = /\b(lowercase|uppercase|casefold|case[- ]sensitive|case[- ]insensitive|trim(?:ming)?|strip(?:ping)?|remov(?:e|ing)|replac(?:e|ing)|collaps(?:e|ing)|preserv(?:e|ing)|keep|divid(?:e|ing)|sum|scale|ascending|descending|decimal|padding|zero[- ]padded|digits?|ISO[- ]?\d*|NFC|NFD|NFKC|NFKD|L[12]|unit norm)\b|add up to|YYYY|E\.164|=>|->|→|小寫|大寫|去除|移除|保留|取代|替換|合併|升冪|降冪|除以|乘以/i.test(intent);
  const observable = rule || /ignor(?:e|ing)\s+(case|spaces|whitespace|capitalization)|\b(maximum|minimum|largest|smallest|arithmetic mean|count|length)\b/i.test(intent);
  if (!vague || observable) return { needsClarification: false, questions: [], coverage: 'limited_rule_check' };
  const text = /\b(name|text|string|email|phone)\b|姓名|名稱|文字|字串/i.test(intent);
  return {
    needsClarification: true,
    questions: [
      text ? 'Which exact transformation or validation rules should apply? Specify case and whitespace behavior where relevant; do not rely on the current implementation.' : 'What exact rule, transformation, or standard defines the requested operation?',
      'Give at least one input and its exact expected output, and state any relevant boundary behavior or excluded inputs.',
    ],
    reason: 'The intent names an operation but does not state an observable rule. The implementation cannot supply a missing requirement.',
    coverage: 'limited_rule_check',
  };
}
