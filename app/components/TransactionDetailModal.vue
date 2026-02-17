<template>
    <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
        <div class="modal glass-card detail-modal">
            <div class="modal-header">
                <div class="modal-actions">
                    <button class="action-btn edit-btn" @click.stop="$emit('edit', transaction)"
                        :title="$t('common.edit')">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                    </button>
                    <button class="action-btn delete-btn" @click.stop="$emit('delete', transaction)"
                        :title="$t('common.delete')">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                    </button>
                </div>
                <h2>{{ $t('transactions.details') }}</h2>
                <button class="close-btn" @click="$emit('close')">×</button>
            </div>

            <div v-if="loading" class="loading-detail">
                <div class="spinner"></div>
            </div>

            <div v-else-if="error" class="detail-error">
                <div class="error-icon">⚠️</div>
                <p>{{ error }}</p>
                <button class="btn btn-secondary" @click="$emit('close')">{{ $t('common.close') }}</button>
            </div>

            <div v-else-if="transaction" class="detail-content">
                <!-- Transaction Type Badge -->
                <div class="type-badge" :class="transaction.transactionType">
                    <span v-if="transaction.transactionType === 'income'">📈 {{ $t('transactions.income') }}</span>
                    <span v-else-if="transaction.transactionType === 'expense'">📉 {{ $t('transactions.expense')
                    }}</span>
                    <span v-else-if="transaction.transactionType === 'transfer'">🔄 {{ $t('transactions.transfer')
                    }}</span>
                    <span v-else-if="transaction.transactionType === 'split'">📊 {{ $t('transactions.split') }}</span>
                </div>

                <!-- Main Amount -->
                <div class="main-amount" :class="transaction.transactionType">
                    {{ formatAmount(transaction.amountFrom, transaction.currencySymbol) }}
                </div>

                <!-- Title -->
                <h3 class="detail-title">{{ transaction.title }}</h3>

                <!-- Date -->
                <div class="detail-date">
                    {{ formatFullDate(transaction.transactionDate) }}
                </div>

                <!-- Details Grid -->
                <div class="details-grid">
                    <!-- From Account -->
                    <div class="detail-row">
                        <span class="label">{{ $t('transactions.fromAccount') }}</span>
                        <span class="value">{{ transaction.fromAccountTitle }}</span>
                    </div>

                    <!-- To Account (for transfers) -->
                    <div v-if="transaction.toAccountId" class="detail-row">
                        <span class="label">{{ $t('transactions.toAccount') }}</span>
                        <span class="value">{{ transaction.toAccountTitle }}</span>
                    </div>

                    <!-- Amount To (if different currency) -->
                    <div v-if="transaction.amountTo && transaction.amountTo !== transaction.amountFrom"
                        class="detail-row">
                        <span class="label">{{ $t('transactions.amountReceived') }}</span>
                        <span class="value success">{{ formatAmount(transaction.amountTo, transaction.currencySymbol)
                        }}</span>
                    </div>

                    <!-- Category (only if not split) -->
                    <div v-if="transaction.categoryTitle && !transaction.isSplit" class="detail-row">
                        <span class="label">{{ $t('transactions.category') }}</span>
                        <span class="value">{{ transaction.categoryTitle }}</span>
                    </div>

                    <!-- Payee -->
                    <div v-if="transaction.payeeTitle" class="detail-row">
                        <span class="label">{{ $t('transactions.payee') }}</span>
                        <span class="value">{{ transaction.payeeTitle }}</span>
                    </div>

                    <!-- Project -->
                    <div v-if="transaction.projectTitle" class="detail-row">
                        <span class="label">{{ $t('transactions.project') }}</span>
                        <span class="value">{{ transaction.projectTitle }}</span>
                    </div>

                    <!-- Automotive badge -->
                    <div v-if="transaction.isAutomotive" class="detail-row">
                        <span class="label">{{ $t('transactions.type') }}</span>
                        <span class="value automotive">🚗 {{ $t('transactions.automotive') }}</span>
                    </div>

                    <!-- Deductible Amount -->
                    <div v-if="transaction.deductibleAmount" class="detail-row">
                        <span class="label">{{ $t('transactions.deductibleAmount') }}</span>
                        <span class="value">{{ transaction.currencySymbol }}{{ transaction.deductibleAmount.toFixed(2)
                        }}</span>
                    </div>
                </div>

                <!-- Automotive Fuel Details -->
                <div v-if="transaction.fuelLog" class="automotive-section">
                    <h4>⛽ {{ $t('automotive.fuelDetails') }}</h4>
                    <div class="automotive-grid">
                        <div class="auto-row">
                            <span class="label">{{ $t('automotive.vehicle') }}</span>
                            <span class="value">{{ transaction.fuelLog.vehicleName }} ({{
                                transaction.fuelLog.licensePlate }})</span>
                        </div>
                        <div class="auto-row">
                            <span class="label">{{ $t('automotive.mileage') }}</span>
                            <span class="value">{{ transaction.fuelLog.odometer?.toLocaleString() }} km</span>
                        </div>
                        <div class="auto-row">
                            <span class="label">{{ $t('automotive.fuel') }}</span>
                            <span class="value">{{ transaction.fuelLog.fuelTypeName }}</span>
                        </div>
                        <div class="auto-row">
                            <span class="label">{{ $t('automotive.liters') }}</span>
                            <span class="value">{{ transaction.fuelLog.fuelVolume }} L</span>
                        </div>
                        <div class="auto-row">
                            <span class="label">{{ $t('automotive.pricePerLiter') }}</span>
                            <span class="value">€ {{ transaction.fuelLog.fuelPricePerUnit?.toFixed(3) }}</span>
                        </div>
                        <div v-if="transaction.fuelLog.distanceSinceLastRefuel" class="auto-row">
                            <span class="label">{{ $t('automotive.distanceTraveled') }}</span>
                            <span class="value">{{ transaction.fuelLog.distanceSinceLastRefuel?.toLocaleString() }}
                                km</span>
                        </div>
                        <div v-if="transaction.fuelLog.averageConsumption" class="auto-row highlight">
                            <span class="label">{{ $t('automotive.averageConsumption') }}</span>
                            <span class="value">{{ transaction.fuelLog.averageConsumption?.toFixed(2) }} km/L</span>
                        </div>
                        <div class="auto-row">
                            <span class="label">{{ $t('automotive.fullTank') }}</span>
                            <span class="value">{{ transaction.fuelLog.isFullTank ? $t('common.yes') + ' ✓' :
                                $t('common.no') }}</span>
                        </div>
                    </div>
                </div>

                <!-- Automotive Maintenance Details -->
                <div v-if="transaction.maintenanceLogs && transaction.maintenanceLogs.length > 0"
                    class="automotive-section">
                    <h4>🔧 {{ $t('automotive.maintenanceDetails') }}</h4>

                    <!-- Vehicle info header -->
                    <div class="maint-vehicle-header">
                        <div class="auto-row">
                            <span class="label">{{ $t('automotive.vehicle') }}</span>
                            <span class="value">{{ transaction.maintenanceLogs?.[0]?.vehicleName }} ({{
                                transaction.maintenanceLogs?.[0]?.licensePlate }})</span>
                        </div>
                        <div class="auto-row">
                            <span class="label">{{ $t('automotive.mileage') }}</span>
                            <span class="value">{{ transaction.maintenanceLogs?.[0]?.odometer?.toLocaleString() }}
                                km</span>
                        </div>
                    </div>

                    <!-- Maintenance items list -->
                    <div class="maint-items-container">
                        <div v-for="item in transaction.maintenanceLogs" :key="item.id" class="maint-item">
                            <div class="maint-info">
                                <span class="maint-type" v-if="item.maintenanceTypeName">{{ item.maintenanceTypeName
                                    }}</span>
                                <span class="maint-type generic" v-else>{{ $t('automotive.genericMaintenance') }}</span>
                                <span class="maint-desc" v-if="item.description">{{ item.description }}</span>
                            </div>
                            <span class="maint-amount">€ {{ item.amount?.toFixed(2) }}</span>
                        </div>
                    </div>

                    <!-- Total -->
                    <div class="maint-total">
                        <span class="label">{{ $t('common.total') }}</span>
                        <span class="value">€ {{transaction.maintenanceLogs.reduce((sum, it) => sum + (it.amount || 0),
                            0).toFixed(2)}}</span>
                    </div>
                </div>

                <!-- Split transactions -->
                <div v-if="transaction.isSplit && transaction.children.length > 0" class="split-section">
                    <h4>{{ $t('transactions.subdivision') }}</h4>
                    <div class="split-list">
                        <div v-for="child in transaction.children" :key="child.id" class="split-item">
                            <div class="split-info">
                                <span class="split-category">
                                    {{ child.isTransfer ? '🔄 ' + $t('transactions.transfer') : (child.categoryTitle ||
                                        $t('transactions.noCategory')) }}
                                </span>
                                <span v-if="child.isTransfer && child.toAccountTitle" class="split-destination">
                                    → {{ child.toAccountTitle }}
                                </span>
                                <span v-if="child.notes" class="split-notes">{{ child.notes }}</span>
                            </div>
                            <span class="split-amount" :class="child.amountFrom < 0 ? 'expense' : 'income'">
                                {{ formatAmount(child.amountFrom, transaction.currencySymbol) }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Notes -->
                <div v-if="transaction.notes" class="notes-section">
                    <h4>{{ $t('common.notes') }}</h4>
                    <p>{{ transaction.notes }}</p>
                </div>

                <!-- Attachments -->
                <div v-if="transaction.attachments.length > 0" class="attachments-section">
                    <h4>📎 {{ $t('transactions.attachments') }} ({{ transaction.attachments.length }})</h4>
                    <div class="attachments-list">
                        <a v-for="att in transaction.attachments" :key="att.id" :href="att.filePath" target="_blank"
                            class="attachment-item">
                            {{ getFileName(att.filePath) }}
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { type PropType } from 'vue'

const { locale } = useI18n()

// Define interfaces if not auto-imported, but assuming they are available or define locally
// For minimal duplication, we'll redefine needed structures or use `any` if Types are global, 
// but better to be explicit.
interface TransactionDetail {
    id: number
    title: string
    amountFrom: number
    amountTo: number | null
    transactionDate: string
    fromAccountId: number
    fromAccountTitle: string
    toAccountId: number | null
    toAccountTitle: string | null
    categoryId: number | null
    categoryTitle: string | null
    projectId: number | null
    projectTitle: string | null
    payeeId: number | null
    payeeTitle: string | null
    currencyCode: string
    currencySymbol: string
    notes: string | null
    deductibleAmount: number | null
    isTransfer: boolean
    isAutomotive: boolean
    parentId: number | null
    transactionType: 'income' | 'expense' | 'transfer' | 'split'
    isSplit: boolean
    children: any[] // Simplified for brevity
    attachments: any[]
    fuelLog?: any
    maintenanceLogs?: any[]
}

const props = defineProps({
    show: Boolean,
    loading: Boolean,
    error: String,
    transaction: Object as PropType<TransactionDetail | null>
})

defineEmits(['close', 'edit', 'delete'])

function formatAmount(amount: number, symbol: string = '€') {
    const sign = amount < 0 ? '-' : '+'
    return `${sign}${symbol}${Math.abs(amount).toFixed(2)}`
}

function formatFullDate(dateStr: string) {
    const date = new Date(dateStr)
    return date.toLocaleDateString(locale.value, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

function getFileName(path: string) {
    return path.split('/').pop() || path
}
</script>

<style scoped>
/* Modal */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--color-modal-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: var(--space-lg);
    backdrop-filter: blur(4px);
}

.detail-modal {
    width: 100%;
    max-width: 500px;
    max-height: 85vh;
    overflow-y: auto;
    padding: var(--space-xl);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-lg);
}

.modal-actions {
    display: flex;
    gap: var(--space-xs);
}

.action-btn {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    border: none;
    background: var(--color-bg-elevated);
    color: var(--color-text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.action-btn:hover {
    background: var(--color-bg-glass);
    color: var(--color-text-primary);
}

.delete-btn:hover {
    background: var(--color-error-bg);
    color: var(--color-error);
}

.modal-header h2 {
    font-size: 1.1rem;
    font-weight: 600;
}

.close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-text-muted);
    cursor: pointer;
}

.loading-detail {
    display: flex;
    justify-content: center;
    padding: var(--space-xl);
}

.detail-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-xl);
    text-align: center;
}

.detail-error .error-icon {
    font-size: 3rem;
}

.detail-error p {
    color: var(--color-error);
}

.detail-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
}

.type-badge {
    align-self: flex-start;
    padding: var(--space-xs) var(--space-md);
    border-radius: var(--radius-lg);
    font-size: 0.8rem;
    font-weight: 500;
}

.type-badge.income {
    background: var(--color-success-bg);
    color: var(--color-success);
}

.type-badge.expense {
    background: var(--color-error-bg);
    color: var(--color-error);
}

.type-badge.transfer {
    background: var(--color-bg-glass);
    color: var(--color-text-secondary);
}

.type-badge.split {
    background: var(--color-accent-bg);
    color: var(--color-accent);
}

.main-amount {
    font-size: 2rem;
    font-weight: 700;
}

.main-amount.income {
    color: var(--color-success);
}

.main-amount.expense {
    color: var(--color-error);
}

.main-amount.transfer {
    color: var(--color-text-secondary);
}

.detail-title {
    font-size: 1.2rem;
    font-weight: 600;
}

.detail-date {
    color: var(--color-text-muted);
    font-size: 0.9rem;
}

.details-grid {
    display: grid;
    gap: var(--space-md);
    padding: var(--space-md);
    background: var(--color-bg-elevated);
    border-radius: var(--radius-md);
}

.detail-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.detail-row .label {
    font-size: 0.75rem;
    color: var(--color-text-muted);
}

.detail-row .value {
    font-weight: 500;
    font-size: 0.95rem;
}

.detail-row .value.success {
    color: var(--color-success);
}

.detail-row .value.automotive {
    color: var(--color-accent);
}

.automotive-section {
    margin-top: var(--space-md);
    padding: var(--space-lg);
    background: var(--color-accent-bg);
    border: 1px solid color-mix(in srgb, var(--color-accent) 15%, transparent);
    border-radius: var(--radius-lg);
}

.automotive-section h4 {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-accent);
    margin-bottom: var(--space-md);
}

.automotive-grid {
    display: grid;
    gap: var(--space-sm);
}

.auto-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
}

.auto-row .label {
    font-size: 0.75rem;
    color: var(--color-text-muted);
}

.auto-row .value {
    font-weight: 500;
    font-size: 0.85rem;
}

.auto-row.highlight {
    margin-top: var(--space-xs);
    padding-top: var(--space-xs);
    border-top: 1px solid color-mix(in srgb, var(--color-accent) 20%, transparent);
    font-weight: 600;
}

/* Maintenance vehicle header */
.maint-vehicle-header {
    display: grid;
    gap: var(--space-sm);
    padding-bottom: var(--space-md);
    margin-bottom: var(--space-md);
    border-bottom: 1px solid color-mix(in srgb, var(--color-accent) 15%, transparent);
}

/* Maintenance items */
.maint-items-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
}

.maint-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    background: var(--color-bg-card);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    transition: transform 0.15s;
}

.maint-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.maint-type {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-text-primary);
}

.maint-type.generic {
    color: var(--color-text-muted);
    font-style: italic;
}

.maint-desc {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.maint-amount {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-error);
    white-space: nowrap;
    margin-left: var(--space-md);
}

/* Maintenance total */
.maint-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--space-md);
    padding-top: var(--space-md);
    border-top: 1px solid color-mix(in srgb, var(--color-accent) 20%, transparent);
}

.maint-total .label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-primary);
}

.maint-total .value {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-accent);
}

.split-section {
    margin-top: var(--space-md);
}

.split-section h4 {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    margin-bottom: var(--space-sm);
}

.split-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
}

.split-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm);
    background: var(--color-bg-elevated);
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
}

.split-info {
    display: flex;
    flex-direction: column;
}

.split-destination {
    font-size: 0.75rem;
    color: var(--color-text-muted);
}

.split-notes {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-style: italic;
}

.split-amount.income {
    color: var(--color-success);
}

.split-amount.expense {
    color: var(--color-error);
}

.notes-section {
    margin-top: var(--space-md);
    padding: var(--space-md);
    background: var(--color-bg-elevated);
    border-radius: var(--radius-md);
}

.notes-section h4 {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-bottom: 4px;
}

.notes-section p {
    white-space: pre-wrap;
    font-size: 0.9rem;
    color: var(--color-text-secondary);
}

.attachments-section {
    margin-top: var(--space-md);
}

.attachments-section h4 {
    font-size: 0.9rem;
    margin-bottom: var(--space-sm);
}

.attachments-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
}

.attachment-item {
    display: flex;
    align-items: center;
    padding: var(--space-sm);
    background: var(--color-bg-elevated);
    border-radius: var(--radius-sm);
    color: var(--color-accent);
    text-decoration: none;
    font-size: 0.9rem;
    transition: background 0.2s;
}

.attachment-item:hover {
    background: var(--color-bg-glass);
    text-decoration: underline;
}

.spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
