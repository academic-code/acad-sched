import { onMounted, onBeforeUnmount } from "vue"

type RefreshMap = Record<string, () => Promise<void>>

export function useRefreshRouter(refreshMap: RefreshMap) {

  async function handle(event: Event) {
    const { table } = (event as CustomEvent).detail || {}

    if (!table) return

    if (refreshMap[table]) {
      console.log(`♻ Auto-Refresh Triggered: ${table}`)
      await refreshMap[table]()
    }
  }

  onMounted(() => window.addEventListener("db:update", handle))
  onBeforeUnmount(() => window.removeEventListener("db:update", handle))
}
