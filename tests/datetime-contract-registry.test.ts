import { describe, expect, it } from "vitest";
import { evaluateDateTimeContract } from "../scripts/datetime-contract.ts";

describe("DateTime schema registry", () => {
  it("reports a timestamp without time zone in a newly populated application schema", () => {
    const result = evaluateDateTimeContract(["public", "leads"], [
      {
        table_schema: "public",
        table_name: "User",
        column_name: "createdAt",
        data_type: "timestamp with time zone",
      },
      {
        table_schema: "leads",
        table_name: "Lead",
        column_name: "created_at",
        data_type: "timestamp without time zone",
      },
    ]);

    expect(result.violations).toEqual([
      "leads.Lead.created_at: timestamp without time zone",
    ]);
    expect(result.summary).toEqual([
      { schema: "public", tables: 1, instantColumns: 1 },
      { schema: "leads", tables: 1, instantColumns: 1 },
    ]);
  });

  it("rejects a non-empty registered schema with no matching instant columns", () => {
    const result = evaluateDateTimeContract(["contracts"], [{
      table_schema: "contracts",
      table_name: "Contract",
      column_name: "id",
      data_type: "text",
    }]);
    expect(result.violations).toEqual([
      "contracts: schema has 1 table(s) but no application-owned UTC instant columns",
    ]);
  });
});
