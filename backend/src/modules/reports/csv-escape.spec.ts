import { csvEscape } from './reports.service';

describe('csvEscape (CSV formula injection guard)', () => {
  it('passes plain ASCII through unchanged', () => {
    expect(csvEscape('Alice')).toBe('Alice');
    expect(csvEscape('123')).toBe('123');
  });

  it('quotes commas, double-quotes and newlines correctly', () => {
    expect(csvEscape('hello, world')).toBe('"hello, world"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });

  it('prefixes a single quote on cells that would be parsed as a spreadsheet formula', () => {
    expect(csvEscape('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvEscape('+cmd|"/c calc"')).toBe('"\'+cmd|""/c calc"""');
    expect(csvEscape('-1+2')).toBe("'-1+2");
    // Comma in the body forces quoting on top of the formula guard.
    expect(csvEscape('@SUM(1,1)')).toBe('"\'@SUM(1,1)"');
    expect(csvEscape('\tINJECTED')).toBe("'\tINJECTED");
    expect(csvEscape('\rINJECTED')).toBe("'\rINJECTED");
  });

  it('treats null-ish / empty input safely', () => {
    expect(csvEscape('')).toBe('');
    expect(csvEscape(undefined as unknown as string)).toBe('');
    expect(csvEscape(null as unknown as string)).toBe('');
  });
});
