<template>
  <div class="period-separator">
    <div class="period-label">{{ label }}</div>
    <div class="period-stats">
      <span class="count">{{ count }} {{ $t('PeriodSeparator.transactions') }}</span>
      <span class="balance" :class="balanceClass">{{ formattedBalance }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  label: string
  count: number
  balance: number
}>()

const formattedBalance = computed(() => {
  const sign = props.balance >= 0 ? '+' : ''
  return `${sign}€${props.balance.toFixed(2)}`
})

const balanceClass = computed(() => {
  if (props.balance > 0) return 'positive'
  if (props.balance < 0) return 'negative'
  return ''
})
</script>

<style scoped>
.period-separator {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) 0;
  margin-top: var(--space-md);
}

.period-separator:first-child {
  margin-top: 0;
}

.period-label {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-weight: 600;
  font-size: 1rem;
  color: var(--color-text-secondary);
}

.period-stats {
  display: flex;
  gap: var(--space-lg);
  font-size: 0.8rem;
}

.count {
  color: var(--color-text-muted);
}

.balance {
  font-weight: 600;
}

.balance.positive {
  color: var(--color-success);
}

.balance.negative {
  color: var(--color-error);
}

@media (max-width: 400px) {
  .period-label {
    font-size: 0.85rem;
  }

  .period-stats {
    gap: var(--space-md);
    font-size: 0.7rem;
  }
}
</style>
