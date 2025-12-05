export default defineNuxtRouteMiddleware(async (to) => {
  const supabase = useNuxtApp().$supabase

  // Routes that should NOT be protected
  const publicRoutes = ["/login", "/welcome"]

  // Allow public pages
  if (publicRoutes.includes(to.path)) return

  // Check session
  const { data } = await supabase.auth.getSession()
  const session = data.session

  // If not logged in → force login
  if (!session) {
    return navigateTo("/login")
  }

  // Get role from db
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("auth_user_id", session.user.id)
    .maybeSingle()

  const role = userData?.role

  // No role yet? Allow access ONLY TO welcome page
  if (!role) {
    return navigateTo("/welcome")
  }

  // Role-based access control
  if (role === "ADMIN" && !to.path.startsWith("/admin")) {
    return navigateTo("/admin")
  }

  if (role === "DEAN" && !to.path.startsWith("/dean")) {
    return navigateTo("/dean")
  }

  if (role === "FACULTY" && !to.path.startsWith("/faculty")) {
    return navigateTo("/faculty")
  }
})
