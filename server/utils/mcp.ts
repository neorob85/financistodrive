import type { ApiTokenOwner } from './api-tokens'
import { createToken, getSessionCookieName } from './auth'
import { readFile } from 'fs/promises'
import { assertTransactionOwner, findTransactionAttachment, saveTransactionAttachment } from './attachments'

/**
 * MCP (Model Context Protocol) server exposed to Claude and other MCP clients.
 *
 * Tools do not query the database themselves: each one calls the same internal API
 * the web app uses, authenticated as the token owner with a short-lived session JWT
 * that never leaves the process. Business rules (balances, billing cycles, ownership
 * checks) therefore stay in one place. Attachments are the exception: the upload API
 * takes multipart form data, so add_attachment uses the same helpers directly.
 */

export const MCP_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']

export const MCP_INSTRUCTIONS = [
    'Financisto Drive is a personal finance and vehicle manager.',
    'Amounts are in the account currency. In transactions, amountFrom is negative for expenses and transfers (money leaving the account) and positive for income.',
    'Special category ids: -1 split transaction, -2 no category, -3 transfer.',
    'Dates are local time, formatted YYYY-MM-DD (date filters) or YYYY-MM-DD HH:mm:ss (transaction dates).',
    'Look up ids with get_accounts, get_categories, get_payees, get_projects and get_vehicles before filtering or creating transactions.',
    'read_attachment shows you an attached image (receipt, invoice) or the text of a txt/csv file.',
    'add_attachment needs the file content as base64: an image the user shared in the chat cannot be re-encoded from what you see, so in that case give the user the editUrl of the transaction to attach it from the app.'
].join(' ')

type JsonSchema = Record<string, unknown>

interface McpTool {
    name: string
    title: string
    description: string
    inputSchema: JsonSchema
    readOnly: boolean
    destructive?: boolean
    run: (args: Record<string, any>, api: InternalApi, ctx: ToolContext) => Promise<unknown>
}

type InternalApi = <T = any>(path: string, options?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; query?: Record<string, unknown>; body?: unknown }) => Promise<T>

interface ToolContext {
    owner: ApiTokenOwner
    // Public origin of the app, to give the user links to its pages
    origin: string
}

const idSchema = (description: string) => ({ type: 'integer', description })
const dateSchema = (description: string) => ({ type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description })
const noArgs: JsonSchema = { type: 'object', properties: {}, additionalProperties: false }

export class McpToolError extends Error { }

/**
 * Returned by a tool to send MCP content blocks (e.g. an image) as they are,
 * instead of its result serialised as JSON text.
 */
class ToolContent {
    constructor(public content: Record<string, unknown>[]) { }
}

// Image formats Claude can see; HEIC and TIFF are stored but not readable by Claude
const READABLE_IMAGE_TYPES: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp'
}
const READABLE_TEXT_TYPES = new Set(['txt', 'csv'])
// Claude rejects images over 5 MB once base64-encoded
const MAX_READ_BINARY_SIZE = Math.floor(5 * 1024 * 1024 * 3 / 4)
const MAX_READ_TEXT_SIZE = 500 * 1024

function requireId(args: Record<string, any>, key: string): number {
    const value = Number(args[key])
    if (!Number.isInteger(value)) throw new McpToolError(`${key} must be an integer`)
    return value
}

function localDateTime(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function parseTransactionDate(value: unknown): string {
    const match = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?::\d{2})?)?$/.exec(String(value))
    if (!match) throw new McpToolError('transactionDate must be YYYY-MM-DD or YYYY-MM-DD HH:mm')
    return `${match[1]} ${match[2] ?? '12:00'}:00`
}

function optionalId(args: Record<string, any>, key: string): number | null {
    return args[key] === undefined || args[key] === null ? null : requireId(args, key)
}

function optionalText(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
}

const editUrl = (ctx: ToolContext, id: number) => `${ctx.origin}/transactions/${id}/edit`

const TOOLS: McpTool[] = [
    {
        name: 'get_accounts',
        title: 'Accounts',
        description: 'List all accounts with current balance, currency and, for credit cards, billing cycle totals and next payment date.',
        inputSchema: noArgs,
        readOnly: true,
        run: (_args, api) => api('/api/accounts')
    },
    {
        name: 'list_transactions',
        title: 'Transactions',
        description: 'List transactions, newest first, paginated (max 50 per page). With accountId, lists the transactions of that account including its running balance; the other filters apply only without accountId.',
        inputSchema: {
            type: 'object',
            properties: {
                page: { type: 'integer', minimum: 1, description: 'Page number, default 1' },
                limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Items per page, default 20' },
                accountId: idSchema('Only transactions of this account (incoming transfers included)'),
                categoryId: idSchema('Filter by category id (-1 split, -2 no category, -3 transfer)'),
                fromAccountId: idSchema('Filter by source account id'),
                projectId: idSchema('Filter by project id'),
                vehicleId: idSchema('Filter by vehicle id (fuel and maintenance)'),
                dateFrom: dateSchema('From this date, inclusive'),
                dateTo: dateSchema('Up to this date, inclusive'),
                deductibleOnly: { type: 'boolean', description: 'Only transactions with a tax-deductible amount' }
            },
            additionalProperties: false
        },
        readOnly: true,
        run: (args, api) => {
            const query: Record<string, unknown> = {}
            for (const key of ['page', 'limit', 'accountId', 'categoryId', 'fromAccountId', 'projectId', 'vehicleId', 'dateFrom', 'dateTo']) {
                if (args[key] !== undefined && args[key] !== null) query[key] = args[key]
            }
            if (args.deductibleOnly) query.deductibleOnly = 'true'
            return api('/api/transactions/list', { query })
        }
    },
    {
        name: 'get_transaction',
        title: 'Transaction details',
        description: 'Get full details of a transaction: notes, payee, project, split children, attachments and vehicle data.',
        inputSchema: {
            type: 'object',
            properties: { id: idSchema('Transaction id') },
            required: ['id'],
            additionalProperties: false
        },
        readOnly: true,
        run: async (args, api, ctx) => {
            const id = requireId(args, 'id')
            const data = await api(`/api/transactions/${id}`)
            return { ...data, editUrl: editUrl(ctx, id) }
        }
    },
    {
        name: 'get_categories',
        title: 'Categories',
        description: 'List categories as a flat list; parentId links a subcategory to its parent.',
        inputSchema: noArgs,
        readOnly: true,
        run: (_args, api) => api('/api/categories')
    },
    {
        name: 'get_payees',
        title: 'Payees',
        description: 'List payees.',
        inputSchema: noArgs,
        readOnly: true,
        run: (_args, api) => api('/api/payees')
    },
    {
        name: 'get_projects',
        title: 'Projects',
        description: 'List projects, which group transactions across categories.',
        inputSchema: noArgs,
        readOnly: true,
        run: (_args, api) => api('/api/projects')
    },
    {
        name: 'get_project_transactions',
        title: 'Project transactions',
        description: 'List the transactions of a project.',
        inputSchema: {
            type: 'object',
            properties: { id: idSchema('Project id') },
            required: ['id'],
            additionalProperties: false
        },
        readOnly: true,
        run: (args, api) => api(`/api/projects/${requireId(args, 'id')}/transactions`)
    },
    {
        name: 'get_currencies',
        title: 'Currencies',
        description: 'List configured currencies.',
        inputSchema: noArgs,
        readOnly: true,
        run: (_args, api) => api('/api/currencies')
    },
    {
        name: 'get_dashboard_stats',
        title: 'Dashboard',
        description: 'Monthly income and expenses history, current and previous month totals and scheduled transactions still due this month.',
        inputSchema: noArgs,
        readOnly: true,
        run: (_args, api) => api('/api/dashboard/stats')
    },
    {
        name: 'get_category_report',
        title: 'Category report',
        description: 'Income and expenses per category in a period, excluding transfers, plus totals and tax-deductible amounts. The period is [from, to): "to" is exclusive, e.g. a whole month is from 2026-01-01 to 2026-02-01.',
        inputSchema: {
            type: 'object',
            properties: {
                from: dateSchema('Start date, inclusive'),
                to: dateSchema('End date, exclusive')
            },
            required: ['from', 'to'],
            additionalProperties: false
        },
        readOnly: true,
        run: (args, api) => api('/api/reports/categories', { query: { from: args.from, to: args.to } })
    },
    {
        name: 'get_schedules',
        title: 'Scheduled transactions',
        description: 'List recurring scheduled transactions with their next date.',
        inputSchema: noArgs,
        readOnly: true,
        run: (_args, api) => api('/api/schedules')
    },
    {
        name: 'get_vehicles',
        title: 'Vehicles',
        description: 'List vehicles.',
        inputSchema: noArgs,
        readOnly: true,
        run: (_args, api) => api('/api/vehicles')
    },
    {
        name: 'get_vehicle',
        title: 'Vehicle details',
        description: 'Get a vehicle with its fuel consumption and maintenance status.',
        inputSchema: {
            type: 'object',
            properties: { id: idSchema('Vehicle id') },
            required: ['id'],
            additionalProperties: false
        },
        readOnly: true,
        run: async (args, api) => {
            const id = requireId(args, 'id')
            const [vehicle, consumption, alerts] = await Promise.all([
                api(`/api/vehicles/${id}`),
                api(`/api/vehicles/${id}/consumption`),
                api(`/api/vehicles/${id}/alerts`)
            ])
            return { vehicle, consumption, alerts }
        }
    },
    {
        name: 'create_transaction',
        title: 'Create transaction',
        description: 'Record an expense, an income or a transfer between two accounts and update account balances. Pass a positive amount: the sign is derived from the type. Requires a token with write access.',
        inputSchema: {
            type: 'object',
            properties: {
                type: { type: 'string', enum: ['expense', 'income', 'transfer'] },
                title: { type: 'string', minLength: 1, maxLength: 255 },
                amount: { type: 'number', exclusiveMinimum: 0, description: 'Positive amount' },
                fromAccountId: idSchema('Account the money leaves (expense, transfer) or enters (income)'),
                toAccountId: idSchema('Destination account, required for transfers'),
                categoryId: idSchema('Category id, ignored for transfers'),
                payeeId: idSchema('Payee id'),
                projectId: idSchema('Project id'),
                transactionDate: { type: 'string', description: 'Local date and time, YYYY-MM-DD or YYYY-MM-DD HH:mm. Default now' },
                notes: { type: 'string' },
                deductibleAmount: { type: 'number', minimum: 0, description: 'Tax-deductible part of the amount' },
                isDeferred: { type: 'boolean', description: 'Credit cards only: the bank billed this charge in the next billing cycle' }
            },
            required: ['type', 'title', 'amount', 'fromAccountId'],
            additionalProperties: false
        },
        readOnly: false,
        run: async (args, api, ctx) => {
            const type = args.type
            if (!['expense', 'income', 'transfer'].includes(type)) throw new McpToolError('type must be expense, income or transfer')
            const title = typeof args.title === 'string' ? args.title.trim() : ''
            if (!title) throw new McpToolError('title is required')
            const amount = Math.abs(Number(args.amount))
            if (!Number.isFinite(amount) || amount === 0) throw new McpToolError('amount must be a positive number')
            const fromAccountId = requireId(args, 'fromAccountId')

            const isTransfer = type === 'transfer'
            const toAccountId = isTransfer ? requireId(args, 'toAccountId') : null
            if (isTransfer && toAccountId === fromAccountId) throw new McpToolError('toAccountId must differ from fromAccountId')

            const transactionDate = args.transactionDate !== undefined
                ? parseTransactionDate(args.transactionDate)
                : localDateTime(new Date())

            // Same payload the web app's new transaction page sends
            const created = await api<{ id: number }>('/api/transactions', {
                method: 'POST',
                body: {
                    title,
                    amountFrom: type === 'income' ? amount : -amount,
                    amountTo: isTransfer ? amount : null,
                    fromAccountId,
                    toAccountId,
                    categoryId: isTransfer ? -3 : (optionalId(args, 'categoryId') || -2),
                    payeeId: optionalId(args, 'payeeId'),
                    projectId: optionalId(args, 'projectId'),
                    transactionDate,
                    notes: optionalText(args.notes),
                    isTransfer,
                    currencyId: 1,
                    deductibleAmount: Number(args.deductibleAmount) > 0 ? Number(args.deductibleAmount) : null,
                    isDeferred: args.isDeferred === true
                }
            })
            return { success: true, id: created.id, editUrl: editUrl(ctx, created.id) }
        }
    },
    {
        name: 'update_transaction',
        title: 'Update transaction',
        description: 'Change an existing transaction: pass its id and only the fields to change, the others keep their value. Account balances are recalculated. Pass null to clear payeeId, projectId, notes or deductibleAmount. For split transactions only title, date, account, payee, project, notes and deferral can change. Fuel and maintenance transactions must be edited in the app. Requires a token with write access.',
        inputSchema: {
            type: 'object',
            properties: {
                id: idSchema('Transaction id'),
                type: { type: 'string', enum: ['expense', 'income', 'transfer'] },
                title: { type: 'string', minLength: 1, maxLength: 255 },
                amount: { type: 'number', exclusiveMinimum: 0, description: 'Positive amount' },
                fromAccountId: idSchema('Account the money leaves (expense, transfer) or enters (income)'),
                toAccountId: idSchema('Destination account, for transfers'),
                categoryId: idSchema('Category id, ignored for transfers'),
                payeeId: { type: ['integer', 'null'], description: 'Payee id, null to clear' },
                projectId: { type: ['integer', 'null'], description: 'Project id, null to clear' },
                transactionDate: { type: 'string', description: 'Local date and time, YYYY-MM-DD or YYYY-MM-DD HH:mm' },
                notes: { type: ['string', 'null'] },
                deductibleAmount: { type: ['number', 'null'], minimum: 0, description: 'Tax-deductible part of the amount, null to clear' },
                isDeferred: { type: 'boolean', description: 'Credit cards only: the bank billed this charge in the next billing cycle' }
            },
            required: ['id'],
            additionalProperties: false
        },
        readOnly: false,
        run: async (args, api, ctx) => {
            const id = requireId(args, 'id')
            const { transaction: tx } = await api(`/api/transactions/${id}`)
            const has = (key: string) => args[key] !== undefined

            if (tx.parentId) {
                throw new McpToolError(`This is a line of split transaction ${tx.parentId}: update that transaction instead`)
            }
            if (tx.isAutomotive) {
                const page = tx.fuelLog ? 'edit-fuel' : 'edit-maintenance'
                throw new McpToolError(`Fuel and maintenance transactions must be edited in the app: ${ctx.origin}/transactions/${id}/${page}`)
            }
            if (tx.isSplit && ['type', 'amount', 'categoryId', 'toAccountId'].some(has)) {
                throw new McpToolError(`The amounts and categories of a split transaction must be edited in the app: ${editUrl(ctx, id)}`)
            }

            const currentType = tx.isTransfer ? 'transfer' : tx.amountFrom > 0 ? 'income' : 'expense'
            const type = has('type') ? args.type : currentType
            if (!['expense', 'income', 'transfer'].includes(type)) throw new McpToolError('type must be expense, income or transfer')
            const isTransfer = type === 'transfer'

            let amount = Math.abs(tx.amountFrom)
            if (has('amount')) {
                amount = Math.abs(Number(args.amount))
                if (!Number.isFinite(amount) || amount === 0) throw new McpToolError('amount must be a positive number')
            }

            const title = has('title') ? optionalText(args.title) : tx.title
            if (!title) throw new McpToolError('title cannot be empty')

            const fromAccountId = has('fromAccountId') ? requireId(args, 'fromAccountId') : tx.fromAccountId
            let toAccountId: number | null = null
            if (isTransfer) {
                toAccountId = has('toAccountId') ? requireId(args, 'toAccountId') : tx.toAccountId
                if (!toAccountId) throw new McpToolError('toAccountId is required for a transfer')
                if (toAccountId === fromAccountId) throw new McpToolError('toAccountId must differ from fromAccountId')
            }

            let categoryId: number
            if (tx.isSplit) categoryId = -1
            else if (isTransfer) categoryId = -3
            else {
                categoryId = has('categoryId') ? requireId(args, 'categoryId') : (tx.categoryId ?? -2)
                // A former transfer keeps its transfer category unless one is given
                if (categoryId === -3 || categoryId === -1) categoryId = -2
            }

            // A transfer between accounts in different currencies may credit a different
            // amount: keep it unless the amount itself changes
            const amountTo = isTransfer
                ? (has('amount') || currentType !== 'transfer' ? amount : (tx.amountTo ?? amount))
                : null

            const deductible = has('deductibleAmount') ? (Number(args.deductibleAmount) > 0 ? Number(args.deductibleAmount) : null) : tx.deductibleAmount

            // Same payload the web app's edit page sends; split lines are passed back unchanged
            await api(`/api/transactions/${id}`, {
                method: 'PUT',
                body: {
                    title,
                    amountFrom: tx.isSplit ? tx.amountFrom : (type === 'income' ? amount : -amount),
                    amountTo: tx.isSplit ? tx.amountTo : amountTo,
                    fromAccountId,
                    toAccountId: tx.isSplit ? tx.toAccountId : toAccountId,
                    categoryId,
                    payeeId: has('payeeId') ? optionalId(args, 'payeeId') : tx.payeeId,
                    projectId: has('projectId') ? optionalId(args, 'projectId') : tx.projectId,
                    transactionDate: has('transactionDate') ? parseTransactionDate(args.transactionDate) : tx.transactionDate,
                    notes: has('notes') ? optionalText(args.notes) : tx.notes,
                    isTransfer: tx.isSplit ? tx.isTransfer : isTransfer,
                    currencyId: tx.currencyId ?? 1,
                    deductibleAmount: deductible,
                    isDeferred: has('isDeferred') ? args.isDeferred === true : tx.isDeferred,
                    splits: tx.isSplit
                        ? tx.children.map((c: any) => ({
                            id: c.id,
                            title: c.title,
                            amountFrom: c.amountFrom,
                            amountTo: c.amountTo,
                            categoryId: c.categoryId,
                            toAccountId: c.toAccountId,
                            isTransfer: c.isTransfer,
                            notes: c.notes
                        }))
                        : undefined
                }
            })

            return { success: true, id, editUrl: editUrl(ctx, id) }
        }
    },
    {
        name: 'add_attachment',
        title: 'Add attachment',
        description: 'Attach a file (receipt photo, invoice...) to a transaction. The content must be the raw file encoded as base64, max 20 MB; allowed types: jpg, jpeg, png, gif, webp, heic, tiff, pdf, doc, docx, xls, xlsx, txt, csv, zip. Requires a token with write access.',
        inputSchema: {
            type: 'object',
            properties: {
                transactionId: idSchema('Transaction id'),
                filename: { type: 'string', minLength: 1, maxLength: 255, description: 'File name with extension, e.g. receipt.jpg' },
                contentBase64: { type: 'string', minLength: 1, description: 'File content encoded as base64 (data: URL prefix allowed)' }
            },
            required: ['transactionId', 'filename', 'contentBase64'],
            additionalProperties: false
        },
        readOnly: false,
        run: async (args, _api, ctx) => {
            const transactionId = requireId(args, 'transactionId')
            const filename = optionalText(args.filename)
            if (!filename) throw new McpToolError('filename is required')

            const base64 = String(args.contentBase64 ?? '').replace(/^data:[^;,]*;base64,/, '').replace(/\s+/g, '')
            if (!base64 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(base64)) {
                throw new McpToolError('contentBase64 must be valid base64')
            }
            const data = Buffer.from(base64, base64.includes('-') || base64.includes('_') ? 'base64url' : 'base64')

            await assertTransactionOwner(ctx.owner.userId, transactionId)
            const path = await saveTransactionAttachment(ctx.owner.userId, transactionId, filename, data)
            return { success: true, transactionId, filePath: `/api${path}`, size: data.length, editUrl: editUrl(ctx, transactionId) }
        }
    },
    {
        name: 'read_attachment',
        title: 'Read attachment',
        description: `Open an attachment of a transaction to look at it: images (jpg, png, gif, webp, up to ${Math.floor(MAX_READ_BINARY_SIZE / 1024 / 1024 * 10) / 10} MB) are returned as images, txt and csv files as text, PDFs as an embedded document. Other types (heic, tiff, office documents, zip) cannot be read: the result gives a link to open them in the app. Attachment ids are listed by get_transaction.`,
        inputSchema: {
            type: 'object',
            properties: {
                transactionId: idSchema('Transaction id'),
                attachmentId: idSchema('Attachment id')
            },
            required: ['transactionId', 'attachmentId'],
            additionalProperties: false
        },
        readOnly: true,
        run: async (args, _api, ctx) => {
            const transactionId = requireId(args, 'transactionId')
            const attachmentId = requireId(args, 'attachmentId')
            const { filePath, ext, size } = await findTransactionAttachment(ctx.owner.userId, transactionId, attachmentId)
            const openInApp = `open it in the app: ${editUrl(ctx, transactionId)}`
            const sizeMb = size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${Math.round(size / 1024 / 1024 * 10) / 10} MB`

            if (READABLE_TEXT_TYPES.has(ext)) {
                if (size > MAX_READ_TEXT_SIZE) throw new McpToolError(`The file is too large to read (${sizeMb}): ${openInApp}`)
                return new ToolContent([{ type: 'text', text: await readFile(filePath, 'utf-8') }])
            }

            const imageType = READABLE_IMAGE_TYPES[ext]
            if (!imageType && ext !== 'pdf') throw new McpToolError(`.${ext} files cannot be read here: ${openInApp}`)
            if (size > MAX_READ_BINARY_SIZE) throw new McpToolError(`The file is too large to read (${sizeMb}): ${openInApp}`)

            const data = (await readFile(filePath)).toString('base64')
            const description = { type: 'text', text: `Attachment ${attachmentId} of transaction ${transactionId} (.${ext}, ${sizeMb})` }

            if (imageType) {
                return new ToolContent([description, { type: 'image', data, mimeType: imageType }])
            }
            return new ToolContent([description, {
                type: 'resource',
                resource: {
                    uri: `${ctx.origin}/api/uploads/attachments/${ctx.owner.userId}/${transactionId}/${filePath.split('/').pop()}`,
                    mimeType: 'application/pdf',
                    blob: data
                }
            }])
        }
    },
    {
        name: 'delete_attachment',
        title: 'Delete attachment',
        description: 'Delete an attachment of a transaction. Attachment ids are listed by get_transaction. Requires a token with write access.',
        inputSchema: {
            type: 'object',
            properties: {
                transactionId: idSchema('Transaction id'),
                attachmentId: idSchema('Attachment id')
            },
            required: ['transactionId', 'attachmentId'],
            additionalProperties: false
        },
        readOnly: false,
        destructive: true,
        run: (args, api) => api(
            `/api/transactions/${requireId(args, 'transactionId')}/attachments/${requireId(args, 'attachmentId')}`,
            { method: 'DELETE' }
        )
    }
]

/**
 * Tools visible to a token: write tools are hidden from read-only tokens.
 */
export function listMcpTools(owner: ApiTokenOwner) {
    return TOOLS
        .filter(tool => tool.readOnly || owner.canWrite)
        .map(tool => ({
            name: tool.name,
            title: tool.title,
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: {
                title: tool.title,
                readOnlyHint: tool.readOnly,
                destructiveHint: tool.destructive === true,
                openWorldHint: false
            }
        }))
}

/**
 * Run a tool as the token owner. Failures are returned as tool results with
 * isError, as the protocol asks, so the model can read and react to them.
 */
export async function callMcpTool(owner: ApiTokenOwner, name: string, args: Record<string, any>, origin: string) {
    const tool = TOOLS.find(t => t.name === name)
    if (!tool || (!tool.readOnly && !owner.canWrite)) {
        return null
    }

    // Short-lived session for the internal calls of this single tool invocation
    const sessionCookie = `${getSessionCookieName()}=${createToken(owner.userId, '5m')}`
    const api: InternalApi = (path, options = {}) => $fetch(path, {
        method: options.method ?? 'GET',
        query: options.query,
        body: options.body as any,
        headers: { cookie: sessionCookie }
    }) as any

    try {
        const data = await tool.run(args ?? {}, api, { owner, origin })
        if (data instanceof ToolContent) return { content: data.content, isError: false }
        return { content: [{ type: 'text', text: JSON.stringify(data) }], isError: false }
    } catch (error: any) {
        // H3 errors (internal API calls, attachment helpers) carry a message meant for
        // the user; anything else is unexpected and stays generic
        const message = error instanceof McpToolError
            ? error.message
            : error?.statusCode ? (error.data?.message || error.message) : 'Internal error'
        if (!(error instanceof McpToolError) && !error?.statusCode) console.error('[mcp] Tool error:', error)
        return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true }
    }
}
