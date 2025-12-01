import { ref } from "vue"

export const show = ref(false)
export const message = ref("")
export const color = ref("success")
export const icon = ref("mdi-check-circle")

export function useAlert() {
  function showAlert(type: "success" | "error" | "warning", msg: string) {
    message.value = msg
    show.value = true

    if (type === "success") {
      color.value = "green-darken-2"
      icon.value = "mdi-check-circle"
    } else if (type === "error") {
      color.value = "red-darken-2"
      icon.value = "mdi-alert-circle"
    } else if (type === "warning") {
      color.value = "orange-darken-2"
      icon.value = "mdi-alert"
    }
  }

  return { showAlert }
}
