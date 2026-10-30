<template>
    <div class="ac-page">
        <header class="page-header">
            <h1>{{ $t('attributeChart.title') }}</h1>
        </header>

        <!-- Loading -->
        <div v-if="loading" class="loading-state">
            <div class="spinner-lg"></div>
        </div>

        <!-- No numeric attributes -->
        <div v-else-if="allSeries.length === 0" class="empty-state">
            <div class="empty-icon">📉</div>
            <p>{{ $t('attributeChart.noAttributes') }}</p>
        </div>

        <template v-else>
            <!-- Attribute chips selector -->
            <div class="selector-section glass-card">
                <p class="selector-label">{{ $t('attributeChart.selectAttributes') }}</p>
                <div class="chips-grid">
                    <button
                        v-for="s in allSeries"
                        :key="s.attributeId"
                        class="chip"
                        :class="{ active: selectedIds.has(s.attributeId) }"
                        @click="toggleAttribute(s.attributeId)"
                    >
                        <span class="chip-dot" :style="{ background: colorForId(s.attributeId) }"></span>
                        {{ s.attributeTitle }}
                        <span v-if="s.unit" class="chip-unit">({{ s.unit }})</span>
                    </button>
                </div>
            </div>

            <!-- No selection hint -->
            <div v-if="selectedIds.size === 0" class="hint-state">
                <p>{{ $t('attributeChart.selectHint') }}</p>
            </div>

            <!-- Chart -->
            <div v-else class="chart-wrapper glass-card">
                <div class="chart-actions">
                    <button class="reset-btn" @click="resetZoom" :title="$t('attributeChart.resetZoom')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                            <path d="M3 3v5h5"/>
                        </svg>
                        {{ $t('attributeChart.resetZoom') }}
                    </button>
                </div>
                <div class="canvas-container">
                    <canvas ref="chartCanvas"></canvas>
                </div>
                <p class="zoom-hint">{{ $t('attributeChart.zoomHint') }}</p>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import type { Chart as ChartType } from 'chart.js'

interface ChartPoint {
    date: string
    value: number
    transactionId: number
    transactionTitle: string
}

interface Series {
    attributeId: number
    attributeTitle: string
    unit: string | null
    points: ChartPoint[]
}

// Chart palette — distinct, accessible colours
const PALETTE = [
    '#6366f1', '#f59e0b', '#10b981', '#ef4444',
    '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
    '#f97316', '#84cc16'
]

function colorForId(id: number): string {
    const idx = allSeries.value.findIndex(s => s.attributeId === id)
    return PALETTE[idx % PALETTE.length]
}

const loading = ref(true)
const allSeries = ref<Series[]>([])
const selectedIds = ref<Set<number>>(new Set())
const chartCanvas = ref<HTMLCanvasElement | null>(null)

let chartInstance: ChartType | null = null

// ─── Data loading ────────────────────────────────────────────────────────────

async function loadData() {
    loading.value = true
    try {
        const data = await $fetch<{ series: Series[] }>('/api/attribute_chart')
        allSeries.value = data.series

        // Auto-select the first attribute
        if (data.series.length > 0) {
            selectedIds.value = new Set([data.series[0].attributeId])
        }
    } catch {
        // leave empty
    } finally {
        loading.value = false
    }
}

// ─── Selection ───────────────────────────────────────────────────────────────

function toggleAttribute(id: number) {
    const next = new Set(selectedIds.value)
    if (next.has(id)) {
        next.delete(id)
    } else {
        next.add(id)
    }
    selectedIds.value = next
}

// ─── Chart ───────────────────────────────────────────────────────────────────

function buildDatasets() {
    return allSeries.value
        .filter(s => selectedIds.value.has(s.attributeId))
        .map((s) => {
            const color = colorForId(s.attributeId)
            return {
                label: s.unit ? `${s.attributeTitle} (${s.unit})` : s.attributeTitle,
                data: s.points.map(p => ({ x: p.date, y: p.value })),
                borderColor: color,
                backgroundColor: color + '22',
                pointBackgroundColor: color,
                pointRadius: 4,
                pointHoverRadius: 6,
                borderWidth: 2.5,
                tension: 0.35,
                fill: false
            }
        })
}

async function renderChart() {
    if (!chartCanvas.value) return

    // Lazy-load Chart.js only on client
    const { Chart, registerables } = await import('chart.js')
    Chart.register(...registerables)
    await import('chartjs-adapter-date-fns')
    const ZoomPlugin = (await import('chartjs-plugin-zoom')).default
    Chart.register(ZoomPlugin)

    const datasets = buildDatasets()

    if (chartInstance) {
        chartInstance.data.datasets = datasets as any
        chartInstance.update('active')
        return
    }

    chartInstance = new Chart(chartCanvas.value, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 400 },
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                x: {
                    type: 'time' as any,
                    time: {
                        unit: 'month',
                        tooltipFormat: 'dd MMM yyyy',
                        displayFormats: { month: 'MMM yy', day: 'dd MMM' }
                    },
                    grid: { color: 'rgba(255,255,255,0.06)' },
                    ticks: { color: 'var(--color-text-secondary)', maxTicksLimit: 8 }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.06)' },
                    ticks: { color: 'var(--color-text-secondary)' }
                }
            },
            plugins: {
                legend: {
                    labels: { color: 'var(--color-text-primary)', padding: 16 }
                },
                tooltip: {
                    backgroundColor: 'rgba(20,20,30,0.9)',
                    titleColor: '#fff',
                    bodyColor: '#ccc',
                    padding: 10,
                    cornerRadius: 8
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x'
                    },
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'x'
                    }
                }
            }
        }
    })
}

function resetZoom() {
    if (chartInstance) {
        (chartInstance as any).resetZoom()
    }
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(async () => {
    await loadData()
})

watch(selectedIds, async () => {
    await nextTick()
    if (selectedIds.value.size > 0) {
        await renderChart()
    } else if (chartInstance) {
        chartInstance.destroy()
        chartInstance = null
    }
}, { deep: true })

onUnmounted(() => {
    if (chartInstance) {
        chartInstance.destroy()
        chartInstance = null
    }
})
</script>

<style scoped>
.ac-page {
    padding: 80px var(--space-lg) var(--space-xxl);
    max-width: 860px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
}

.page-header h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text-primary);
}

/* ── Chips selector ── */
.selector-section {
    padding: var(--space-lg);
}

.selector-label {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    margin-bottom: var(--space-md);
}

.chips-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
}

.chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 999px;
    border: 1.5px solid var(--color-border);
    background: var(--color-bg-glass);
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all var(--transition-fast);
    font-family: inherit;
}

.chip:hover {
    border-color: var(--color-border-focus);
    color: var(--color-text-primary);
}

.chip.active {
    border-color: transparent;
    background: var(--color-accent);
    color: var(--color-text-on-accent);
}

.chip-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

.chip.active .chip-dot {
    background: rgba(255,255,255,0.8) !important;
}

.chip-unit {
    opacity: 0.7;
    font-size: 0.78rem;
}

/* ── Hint ── */
.hint-state {
    text-align: center;
    color: var(--color-text-secondary);
    padding: var(--space-xl);
    font-size: 0.9rem;
}

/* ── Chart wrapper ── */
.chart-wrapper {
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
}

.chart-actions {
    display: flex;
    justify-content: flex-end;
}

.reset-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    background: var(--color-bg-glass);
    color: var(--color-text-secondary);
    font-size: 0.82rem;
    cursor: pointer;
    font-family: inherit;
    transition: all var(--transition-fast);
}

.reset-btn:hover {
    border-color: var(--color-border-focus);
    color: var(--color-text-primary);
}

.canvas-container {
    position: relative;
    height: 340px;
    width: 100%;
    touch-action: none; /* Let Chart.js handle touch */
}

canvas {
    width: 100% !important;
    height: 100% !important;
}

.zoom-hint {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    text-align: center;
    opacity: 0.65;
    margin: 0;
}

/* ── States ── */
.loading-state {
    display: flex;
    justify-content: center;
    padding: var(--space-xxl);
}

.empty-state {
    text-align: center;
    padding: var(--space-xxl);
    color: var(--color-text-secondary);
}

.empty-icon {
    font-size: 3rem;
    margin-bottom: var(--space-md);
}
</style>
