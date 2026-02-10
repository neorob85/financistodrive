<template>
  <div class="transaction-card" :class="{ 'card-maintenance': transaction.logType === 'maintenance' }" @click="$emit('click')">
    <!-- Date badge -->
    <div class="tx-date-badge" :class="transactionType">
      <span class="tx-day">{{ dayNumber }}</span>
      <span class="tx-month">{{ monthLabel }}</span>
      <span class="tx-year">{{ txYear }}</span>
    </div>

    <!-- Transaction info -->
    <div class="tx-info">
      <div class="tx-title">{{ transaction.title }}</div>
      <div class="tx-meta">
        <span class="tx-badge">{{ txTime }}</span>
        <span class="tx-badge">{{ transaction.accountTitle }}</span>
        <span v-if="transaction.categoryTitle" class="tx-category">{{ transaction.categoryTitle }}</span>
        <span v-if="transaction.vehicleName" class="tx-badge">🚗 {{ transaction.vehicleName }}</span>
        <span v-if="transaction.odometer" class="tx-badge">🛣️ {{ transaction.odometer }} km</span>
        <span v-if="transaction.logType === 'fuel' && transaction.averageConsumption" class="tx-badge tx-consumption-badge">⛽ {{ transaction.averageConsumption }} km/L</span>
      </div>
    </div>

    <!-- Amount -->
    <div class="tx-amount" :class="transactionType">
      {{ formattedAmount }}
    </div>
  </div>
</template>

<script setup lang="ts">
interface Transaction {
  id: number
  title: string
  amountFrom: number
  amountTo?: number | null
  transactionDate: string
  categoryTitle?: string | null
  accountTitle: string
  toAccountId?: number | null
  vehicleName?: string | null
  odometer?: number | null
  logType?: string | null
  averageConsumption?: number | null
}

const props = defineProps<{
  transaction: Transaction
}>()

defineEmits(['click'])

const transactionType = computed(() => {
  if (props.transaction.toAccountId) {
    return 'transfer'
  }
  return props.transaction.amountFrom < 0 ? 'expense' : 'income'
})

const formattedAmount = computed(() => {
  const amount = Math.abs(props.transaction.amountFrom)
  const sign = props.transaction.amountFrom < 0 ? '-' : (props.transaction.toAccountId ? '' : '+')
  return `${sign}€${amount.toFixed(2)}`
})

// Parse date string as local time (not UTC) to avoid timezone offset issues
function parseLocalDate(dateStr: string): Date {
  // Handle both ISO format with T and database format with space
  const normalized = dateStr.replace('T', ' ').replace('Z', '')
  const parts = normalized.split(' ')
  const datePart = parts[0] || ''
  const timePart = parts[1] || '00:00:00'
  const dateParts = datePart.split('-')
  const timeParts = timePart.split(':')
  const year = parseInt(dateParts[0] || '0', 10)
  const month = parseInt(dateParts[1] || '1', 10) - 1
  const day = parseInt(dateParts[2] || '1', 10)
  const hours = parseInt(timeParts[0] || '0', 10)
  const minutes = parseInt(timeParts[1] || '0', 10)
  const seconds = parseInt(timeParts[2] || '0', 10)
  return new Date(year, month, day, hours, minutes, seconds)
}

const dayNumber = computed(() => {
  const date = parseLocalDate(props.transaction.transactionDate)
  return date.getDate()
})

const monthLabel = computed(() => {
  const date = parseLocalDate(props.transaction.transactionDate)
  return date.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '').toUpperCase()
})

const txYear = computed(() => {
  const date = parseLocalDate(props.transaction.transactionDate)
  return String(date.getFullYear())
})

const txTime = computed(() => {
  const date = parseLocalDate(props.transaction.transactionDate)
  return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
})
</script>

<style scoped>
.transaction-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  background: var(--color-bg-card);
  backdrop-filter: blur(20px);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.transaction-card:hover {
  transform: translateX(4px);
  box-shadow: var(--shadow-lg);
}

.transaction-card.card-maintenance {
  border-left: 3px solid var(--color-warning-border);
  background: linear-gradient(135deg, var(--color-warning-bg), var(--color-bg-card));
}

.tx-date-badge {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 1;
}

.tx-date-badge.income {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.tx-date-badge.expense {
  background: var(--color-error-bg);
  color: var(--color-error);
}

.tx-date-badge.transfer {
  background: var(--color-bg-glass);
  color: var(--color-text-secondary);
}

.tx-day {
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1;
}

.tx-month {
  font-size: 0.55rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  line-height: 1;
  margin-top: 1px;
}

.tx-year {
  font-size: 0.5rem;
  font-weight: 500;
  line-height: 1;
  opacity: 0.7;
}

.tx-info {
  flex: 1;
  min-width: 0;
}

.tx-title {
  font-weight: 500;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.tx-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.tx-badge {
  background: var(--color-bg-glass);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
}

.tx-category {
  background: var(--color-bg-glass);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}

.tx-consumption-badge {
  background: var(--color-accent-bg, rgba(99, 102, 241, 0.12));
  color: var(--color-accent, #6366f1);
  font-weight: 600;
}

.tx-amount {
  font-weight: 600;
  font-size: 1rem;
  white-space: nowrap;
}

.tx-amount.income {
  color: var(--color-success);
}

.tx-amount.expense {
  color: var(--color-error);
}

.tx-amount.transfer {
  color: var(--color-text-secondary);
}

@media (max-width: 400px) {
  .tx-meta {
    font-size: 0.7rem;
  }

  .tx-amount {
    font-size: 0.9rem;
  }
}
</style>
