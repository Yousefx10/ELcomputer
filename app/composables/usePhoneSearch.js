// Phones keep search out of the header. It opens above the tab bar on request.
let release = null

export const usePhoneSearch = () => {
  const open = useState('phone-search-open', () => false)
  const place = () => {
    const viewport = window.visualViewport
    if (!viewport) return
    const keyboard = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
    const root = document.documentElement
    root.style.setProperty('--phone-search-keyboard', `${keyboard}px`)
    root.style.setProperty('--phone-search-space', `${viewport.height}px`)
    root.classList.toggle('store-search-keyboard', keyboard > 80)
  }
  const show = () => {
    // The class goes on before focus so the keyboard opens within the same tap.
    document.documentElement.classList.add('store-search-open')
    open.value = true
    place()
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', place)
    viewport?.addEventListener('scroll', place)
    release = () => { viewport?.removeEventListener('resize', place); viewport?.removeEventListener('scroll', place) }
    document.getElementById('store-search-input')?.focus()
  }
  const hide = () => {
    if (!open.value) return
    open.value = false
    release?.()
    release = null
    document.documentElement.classList.remove('store-search-open', 'store-search-keyboard')
    document.getElementById('store-search-input')?.blur()
  }
  return { open, show, hide, toggle: () => (open.value ? hide() : show()) }
}
