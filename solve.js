export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  const len = text.length;
  let pos = text.charCodeAt(0) === 0xFEFF ? 1 : 0;
  let line = 1;
  // Native searches skip runs of ordinary characters without allocating match arrays.
  const plainEnd = /[,\r\n]/g;
  const quotedEnd = /["\r\n]/g;

  while (pos < len) {
    let ch = text.charCodeAt(pos);
    if (ch === 10 || (ch === 13 && text.charCodeAt(pos + 1) === 10)) {
      pos += ch === 10 ? 1 : 2;
      line++;
      continue;
    }

    const recordLine = line;
    const recordRow = header && columns === null ? null : rows.length;
    const fields = width < 0 ? [] : new Array(width);
    let count = 0;
    let quoted;
    do {
      quoted = ch === 34;
      let start = pos;
      let value = '';
      let closed = false;
      if (quoted) {
        const openLine = line;
        start = ++pos;
        let segment = pos;
        while (pos < len) {
          quotedEnd.lastIndex = pos;
          if (!quotedEnd.test(text)) break;
          pos = quotedEnd.lastIndex - 1;
          ch = text.charCodeAt(pos);
          if (ch === 34) {
            value += text.slice(segment, pos++);
            if (text.charCodeAt(pos) !== 34) {
              closed = true;
              break;
            }
            value += '"';
            segment = ++pos;
          } else if (ch === 13) {
            value += text.slice(segment, pos) + '\n';
            pos += text.charCodeAt(pos + 1) === 10 ? 2 : 1;
            segment = pos;
            line++;
          } else {
            if (ch === 10) line++;
            pos++;
          }
        }
        // An unclosed quote is literal. Reparse from just after it.
        if (closed) {
          start = pos;
        } else {
          pos = start;
          line = openLine;
          value = '"';
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        }
        ch = text.charCodeAt(pos);
      }

      // Append an unquoted field or the suffix after a closing quote.
      let added = false;
      while (pos < len && ch !== 44 && ch !== 10) {
        if (ch !== 13) {
          plainEnd.lastIndex = pos;
          if (!plainEnd.test(text)) {
            pos = len;
            ch = NaN;
            break;
          }
          pos = plainEnd.lastIndex - 1;
          ch = text.charCodeAt(pos);
          if (ch !== 13) break;
        }
        if (text.charCodeAt(pos + 1) === 10) break;
        if (pos > start) {
          value += text.slice(start, pos);
          added = true;
        }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        start = pos + 1;
        ch = text.charCodeAt(++pos);
      }
      if (pos > start) value += text.slice(start, pos);
      if (closed && (added || pos > start)) {
        errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      }
      fields[count++] = value;

      if (ch !== 44) {
        if (pos < len) {
          pos += ch === 10 ? 1 : 2;
          line++;
        }
        break;
      }
      ch = text.charCodeAt(++pos);
    } while (true);

    if (count === 1 && fields[0] === '' && !quoted) continue;
    if (width < 0) width = count;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (count < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: count });
      while (count < width) fields[count++] = '';
    } else if (count > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
