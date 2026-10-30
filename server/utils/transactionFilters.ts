/**
 * Build optional filter conditions for the global transactions list.
 * Conditions reference the `transactions` table as alias `t` and replace
 * the FILTERS placeholder in the SQL files that support it.
 */
export function buildTransactionFilters(query: Record<string, unknown>): { sql: string; params: (number | string)[] } {
    const toId = (v: unknown) => {
        const n = Number(v)
        return Number.isInteger(n) && n > 0 ? n : null
    }
    const toDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null

    const conditions: string[] = []
    const params: (number | string)[] = []

    // Special categories have negative ids: -1 <SPLIT>, -2 <NO_CATEGORY>, -3 <TRANSFER>
    const rawCategoryId = Number(query.categoryId)
    const categoryId = Number.isInteger(rawCategoryId) && rawCategoryId !== 0 ? rawCategoryId : null
    if (categoryId) {
        conditions.push('t.category_id = ?')
        params.push(categoryId)
    }
    const fromAccountId = toId(query.fromAccountId)
    if (fromAccountId) {
        conditions.push('t.from_account_id = ?')
        params.push(fromAccountId)
    }
    const projectId = toId(query.projectId)
    if (projectId) {
        conditions.push('t.project_id = ?')
        params.push(projectId)
    }
    const vehicleId = toId(query.vehicleId)
    if (vehicleId) {
        conditions.push(`(EXISTS (SELECT 1 FROM fuels_logs f WHERE f.transaction_id = t.id AND f.vehicle_id = ?)
            OR EXISTS (SELECT 1 FROM maintenances_logs m WHERE m.transaction_id = t.id AND m.vehicle_id = ?))`)
        params.push(vehicleId, vehicleId)
    }
    const dateFrom = toDate(query.dateFrom)
    if (dateFrom) {
        conditions.push('t.transaction_date >= ?')
        params.push(`${dateFrom} 00:00:00`)
    }
    const dateTo = toDate(query.dateTo)
    if (dateTo) {
        conditions.push('t.transaction_date <= ?')
        params.push(`${dateTo} 23:59:59`)
    }
    if (query.deductibleOnly === 'true' || query.deductibleOnly === '1') {
        conditions.push('t.deductible_amount > 0')
    }

    return { sql: conditions.map(c => `AND ${c}`).join('\n  '), params }
}
