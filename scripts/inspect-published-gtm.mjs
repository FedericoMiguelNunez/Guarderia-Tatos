// Read the public container as text; never execute tags or send events.
const response = await fetch('https://www.googletagmanager.com/gtm.js?id=GTM-MC2Z95VT', { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`GTM_READ_HTTP_${response.status}`);
const text = await response.text();
const start = text.indexOf('"resource":');
if (start < 0) throw new Error('GTM_RESOURCE_NOT_FOUND');
const opening = text.indexOf('{', start);
let depth = 0, quoted = false, escaped = false, end;
for (let i = opening; i < text.length; i++) {
  const char = text[i];
  if (quoted) {
    if (escaped) escaped = false;
    else if (char === '\\') escaped = true;
    else if (char === '"') quoted = false;
  } else if (char === '"') quoted = true;
  else if (char === '{') depth++;
  else if (char === '}' && --depth === 0) { end = i + 1; break; }
}
const resource = JSON.parse(text.slice(opening, end));
console.log(JSON.stringify({ container: 'GTM-MC2Z95VT', checkedAt: new Date().toISOString(), predicates: resource.predicates, rules: resource.rules, macros: resource.macros, tagTypes: resource.tags?.map((tag, index) => ({ index, type: tag.function })) }, null, 2));
