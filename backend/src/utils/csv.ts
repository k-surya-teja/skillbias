export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const escaped = (value: unknown) =>
    `"${String(value ?? "")
      .replace(/"/g, '""')
      .replace(/\n/g, " ")}"`;

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escaped(row[header])).join(",")),
  ];

  return lines.join("\n");
}
