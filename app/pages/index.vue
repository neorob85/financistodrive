<template>
  <div class="dashboard-page">
    <h1 class="page-title">{{ $t('dashboard.title') }}</h1>

    <div v-if="loading" class="loading-state">
      <div class="spinner-lg"></div>
    </div>

    <template v-else>
      <!-- Summary cards -->
      <div class="stats-grid">
        <div class="stat-card glass-card">
          <div class="stat-header">
            <span class="stat-icon expense-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                <polyline points="17 18 23 18 23 12" />
              </svg>
            </span>
            <span class="stat-label">{{ $t('dashboard.monthlyExpenses') }}</span>
          </div>
          <div class="stat-value expense">€ {{ formatAmount(stats.currentMonth.expenses) }}</div>
        </div>

        <div class="stat-card glass-card">
          <div class="stat-header">
            <span class="stat-icon income-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            </span>
            <span class="stat-label">{{ $t('dashboard.monthlyIncome') }}</span>
          </div>
          <div class="stat-value income">€ {{ formatAmount(stats.currentMonth.income) }}</div>
        </div>

        <div class="stat-card glass-card">
          <div class="stat-header">
            <span class="stat-icon avg-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </span>
            <span class="stat-label">{{ $t('dashboard.monthlyAverage') }}</span>
          </div>
          <div class="stat-averages">
            <div class="avg-row">
              <span class="avg-label">{{ $t('dashboard.expenses') }}</span>
              <span class="avg-value expense">€ {{ formatAmount(stats.averages.expenses) }}</span>
            </div>
            <div class="avg-row">
              <span class="avg-label">{{ $t('dashboard.income') }}</span>
              <span class="avg-value income">€ {{ formatAmount(stats.averages.income) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Chart card -->
      <div class="chart-card glass-card">
        <h2 class="chart-title">{{ $t('dashboard.monthlyTrend') }}</h2>
        <div v-if="stats.months.length === 0" class="chart-empty">
          <p>{{ $t('common.noData') }}</p>
        </div>
        <div v-else class="chart-container">
          <div class="chart-bars">
            <div v-for="m in stats.months" :key="m.month" class="chart-month">
              <div class="bars-wrapper">
                <div class="bar-track">
                  <div class="bar bar-expense" :style="{ height: getBarHeight(m.expenses) + '%' }">
                    <span v-if="m.expenses > 0" class="bar-tooltip">€ {{ formatAmount(m.expenses) }}</span>
                  </div>
                </div>
                <div class="bar-track">
                  <div class="bar bar-income" :style="{ height: getBarHeight(m.income) + '%' }">
                    <span v-if="m.income > 0" class="bar-tooltip">€ {{ formatAmount(m.income) }}</span>
                  </div>
                </div>
              </div>
              <span class="month-label">{{ formatMonthLabel(m.month) }}</span>
            </div>
          </div>
          <div class="chart-legend">
            <div class="legend-item">
              <span class="legend-dot expense-dot"></span>
              <span>{{ $t('dashboard.expenses') }}</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot income-dot"></span>
              <span>{{ $t('dashboard.income') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Vehicle cards -->
      <div v-if="vehicles.length > 0" class="vehicles-section">
        <h2 class="section-title">Veicoli</h2>
        <div class="vehicles-grid">
          <div v-for="v in vehicles" :key="v.id" class="vehicle-card glass-card">
            <div class="vehicle-header">
              <div class="vehicle-info">
                <span class="vehicle-icon">🚗</span>
                <div>
                  <h3 class="vehicle-name">{{ v.brand }} {{ v.model }}</h3>
                  <span v-if="v.licensePlate" class="vehicle-plate">{{ v.licensePlate }}</span>
                </div>
              </div>
              <div class="vehicle-alerts">
                <span v-if="v.alertsOverdue > 0" class="alert-badge overdue" :title="v.alertsOverdue + ' manutenzioni scadute'" @click="router.push('/alerts')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                  {{ v.alertsOverdue }}
                </span>
                <span v-if="v.alertsUpcoming > 0" class="alert-badge upcoming" :title="v.alertsUpcoming + ' manutenzioni in scadenza'" @click="router.push('/alerts')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                  {{ v.alertsUpcoming }}
                </span>
              </div>
            </div>

            <div class="vehicle-stats">
              <div class="vehicle-stat-row">
                <span class="stat-key">Km attuali</span>
                <span class="stat-val">{{ v.currentMileage ? formatNumber(v.currentMileage) + ' km' : '—' }}</span>
              </div>
              <div class="vehicle-stat-row">
                <span class="stat-key">Consumo medio</span>
                <span class="stat-val">{{ v.avgConsumption != null ? v.avgConsumption + ' km/L' : '—' }}</span>
              </div>
              <div class="vehicle-stat-row">
                <span class="stat-key">Costo/km (gestione)</span>
                <span class="stat-val">{{ v.runningCostPerKm != null ? '€ ' + v.runningCostPerKm.toFixed(3) : '—' }}</span>
              </div>
              <div class="vehicle-stat-row">
                <span class="stat-key">Costo/km (totale)</span>
                <span class="stat-val">{{ v.costPerKm != null ? '€ ' + v.costPerKm.toFixed(3) : '—' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const router = useRouter()

interface MonthData {
  month: string
  income: number
  expenses: number
}

interface DashboardStats {
  currentMonth: { expenses: number; income: number }
  averages: { expenses: number; income: number }
  months: MonthData[]
}

interface VehicleStats {
  id: number
  brand: string
  model: string
  licensePlate: string | null
  currentMileage: number | null
  kmDriven: number
  totalFuelCost: number
  totalMaintenanceCost: number
  costPerKm: number | null
  runningCostPerKm: number | null
  avgConsumption: number | null
  alertsUpcoming: number
  alertsOverdue: number
}

const loading = ref(true)
const stats = ref<DashboardStats>({
  currentMonth: { expenses: 0, income: 0 },
  averages: { expenses: 0, income: 0 },
  months: []
})
const vehicles = ref<VehicleStats[]>([])

const maxValue = computed(() => {
  let max = 0
  for (const m of stats.value.months) {
    if (m.expenses > max) max = m.expenses
    if (m.income > max) max = m.income
  }
  return max || 1
})

function getBarHeight(value: number): number {
  return Math.max(2, (value / maxValue.value) * 100)
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatNumber(num: number): string {
  return num.toLocaleString('it-IT')
}

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-')
  const date = new Date(Number(year), Number(month) - 1)
  return date.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')
}

onMounted(async () => {
  try {
    const [statsData, vehiclesData] = await Promise.all([
      $fetch<DashboardStats>('/api/dashboard/stats'),
      $fetch<{ vehicles: VehicleStats[] }>('/api/dashboard/vehicles')
    ])
    stats.value = statsData
    vehicles.value = vehiclesData.vehicles
  } catch (error) {
    console.error('Failed to load dashboard:', error)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.dashboard-page {
  padding: var(--space-lg);
  max-width: 800px;
  margin: 0 auto;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: var(--space-xl);
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: var(--space-xl);
}

.spinner-lg {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Stats grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.stat-card {
  padding: var(--space-lg);
}

.stat-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.stat-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.expense-icon {
  background: var(--color-error-bg);
  color: var(--color-error);
}

.income-icon {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.avg-icon {
  background: var(--color-accent-bg);
  color: var(--color-accent);
}

.stat-label {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  font-weight: 500;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
}

.stat-value.expense {
  color: var(--color-error);
}

.stat-value.income {
  color: var(--color-success);
}

.stat-averages {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.avg-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.avg-label {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.avg-value {
  font-size: 1.1rem;
  font-weight: 600;
}

.avg-value.expense {
  color: var(--color-error);
}

.avg-value.income {
  color: var(--color-success);
}

/* Chart */
.chart-card {
  padding: var(--space-xl);
}

.chart-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: var(--space-lg);
}

.chart-empty {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-muted);
}

.chart-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.chart-bars {
  display: flex;
  gap: var(--space-xs);
  align-items: flex-end;
  height: 200px;
  overflow-x: auto;
  padding-bottom: var(--space-sm);
}

.chart-month {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  flex: 1;
  min-width: 44px;
}

.bars-wrapper {
  display: flex;
  gap: 3px;
  align-items: flex-end;
  height: 180px;
  width: 100%;
}

.bar-track {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: flex-end;
}

.bar {
  width: 100%;
  border-radius: 4px 4px 0 0;
  min-height: 2px;
  transition: height 0.4s ease;
  position: relative;
  cursor: default;
}

.bar-expense {
  background: linear-gradient(180deg, #ef4444, #dc2626);
}

.bar-income {
  background: linear-gradient(180deg, #10b981, #059669);
}

.bar-tooltip {
  display: none;
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 0.65rem;
  white-space: nowrap;
  pointer-events: none;
  margin-bottom: 4px;
  color: var(--color-text-primary);
}

.bar:hover .bar-tooltip {
  display: block;
}

.month-label {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  text-transform: capitalize;
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: var(--space-lg);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.expense-dot {
  background: #ef4444;
}

.income-dot {
  background: #10b981;
}

/* Vehicles section */
.vehicles-section {
  margin-top: var(--space-xl);
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: var(--space-lg);
}

.vehicles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-lg);
}

.vehicle-card {
  padding: var(--space-lg);
}

.vehicle-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-md);
}

.vehicle-info {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.vehicle-icon {
  font-size: 1.5rem;
}

.vehicle-name {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.vehicle-plate {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.vehicle-alerts {
  display: flex;
  gap: var(--space-xs);
}

.alert-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.alert-badge:hover {
  opacity: 0.8;
}

.alert-badge.overdue {
  background: var(--color-error-bg);
  color: var(--color-error);
}

.alert-badge.upcoming {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.vehicle-stats {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-md);
}

.vehicle-stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-key {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.stat-val {
  font-size: 0.9rem;
  font-weight: 600;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 500px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .vehicles-grid {
    grid-template-columns: 1fr;
  }

  .chart-bars {
    height: 160px;
  }

  .bars-wrapper {
    height: 140px;
  }
}
</style>
