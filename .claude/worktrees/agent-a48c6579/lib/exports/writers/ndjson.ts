export function toNDJSON(rows: any[]) {
  return rows.map((r) => JSON.stringify(r)).join("\n")
}


