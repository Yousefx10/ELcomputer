// Private Broadcast contains a change signal only. The owned-order API supplies data.
export const useShipmentUpdates = (orderId, refresh) => {
  const supabase = useSupabaseClient()
  let channel, timer, subscription, version = 0, disposed = false
  const stopChannel = () => {
    clearTimeout(timer)
    if (channel) void supabase.removeChannel(channel)
    channel = null
  }
  const changed = () => {
    clearTimeout(timer)
    timer = setTimeout(() => { if (!disposed) void refresh() }, 250)
  }
  const connect = async () => {
    const active = ++version
    stopChannel()
    const { data } = await supabase.auth.getSession()
    if (disposed || active !== version || !data.session?.access_token || !orderId.value) return
    await supabase.realtime.setAuth(data.session.access_token)
    if (disposed || active !== version) return
    channel = supabase.channel(`shipping:order:${orderId.value}`, { config: { private: true } })
      .on('broadcast', { event: 'changed' }, changed).subscribe(status => { if (status === 'SUBSCRIBED') changed() })
  }
  watch(orderId, () => { void connect().catch(() => {}) })
  onMounted(() => {
    void connect().catch(() => {})
    subscription = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) { version++; stopChannel() }
      else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') setTimeout(() => { if (!disposed) void connect().catch(() => {}) }, 0)
    }).data.subscription
  })
  onBeforeUnmount(() => { disposed = true; version++; stopChannel(); subscription?.unsubscribe() })
}
