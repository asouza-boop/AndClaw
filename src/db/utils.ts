export function buildBatchInsert(
  tableName: string,
  columns: string[],
  rows: any[][],
  conflictClause?: string
): { text: string; values: any[] } {
  if (rows.length === 0) {
    throw new Error("Empty batch");
  }

  const values: any[] = [];
  const valueStrings = rows.map(row => {
    const rowParams = row.map(val => {
      values.push(val);
      return `$${values.length}`;
    });
    return `(${rowParams.join(', ')})`;
  });

  const text = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${valueStrings.join(', ')} ${conflictClause || ''}`;
  return { text, values };
}
