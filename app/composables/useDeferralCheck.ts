/**
 * Shared state for the "billed in the next cycle" flag on the transaction forms.
 *
 * The flag is only offered on credit cards, and ticking it can be a mistake: if the
 * cycle the charge is being moved out of has already been settled, the money went out
 * with that payment and will go out again with the next one. The check reports that
 * without blocking — correcting history is a legitimate reason to do it anyway.
 */
export function useDeferralCheck() {
    const alreadyPaid = ref(false)
    const dueDate = ref<string | null>(null)
    const checking = ref(false)

    function reset() {
        alreadyPaid.value = false
        dueDate.value = null
    }

    async function check(accountId: number | null, transactionDate: string | null, isDeferred: boolean) {
        if (!isDeferred || !accountId || !transactionDate) {
            reset()
            return
        }

        checking.value = true
        try {
            const res = await $fetch<{ alreadyPaid: boolean; dueDate: string | null }>(
                '/api/transactions/deferral-check',
                { query: { accountId, date: transactionDate } }
            )
            alreadyPaid.value = res.alreadyPaid
            dueDate.value = res.dueDate
        } catch {
            // A failed check must not stand in the way of saving
            reset()
        } finally {
            checking.value = false
        }
    }

    return { alreadyPaid, dueDate, checking, check, reset }
}
