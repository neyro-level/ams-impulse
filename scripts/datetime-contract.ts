export interface InformationSchemaColumn {
  table_schema: string;
  table_name: string;
  column_name: string;
  data_type: string;
}

export interface DateTimeSchemaSummary {
  schema: string;
  tables: number;
  instantColumns: number;
}

const instantColumnName = /(?:At|_at)$/;

export function evaluateDateTimeContract(
  schemas: readonly string[],
  columns: InformationSchemaColumn[],
  exemptColumns: readonly string[] = [],
) {
  const violations: string[] = [];
  const summary: DateTimeSchemaSummary[] = [];
  const exemptions = new Set(exemptColumns);

  for (const schema of schemas) {
    const schemaColumns = columns.filter((column) => column.table_schema === schema);
    const tables = new Set(schemaColumns.map((column) => column.table_name));
    const instantColumns = schemaColumns.filter((column) => {
      const columnKey = `${column.table_schema}.${column.table_name}.${column.column_name}`;
      return instantColumnName.test(column.column_name) && !exemptions.has(columnKey);
    });

    if (tables.size > 0 && instantColumns.length === 0) {
      violations.push(`${schema}: schema has ${tables.size} table(s) but no application-owned UTC instant columns`);
    }
    for (const column of instantColumns) {
      if (column.data_type !== "timestamp with time zone") {
        violations.push(
          `${column.table_schema}.${column.table_name}.${column.column_name}: ${column.data_type}`,
        );
      }
    }
    summary.push({ schema, tables: tables.size, instantColumns: instantColumns.length });
  }

  return { violations, summary };
}
