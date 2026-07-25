export const normalizeDashboardLayout = (value) => {
  return String(value || '').trim().toLowerCase() === 'detailed'
    ? 'detailed'
    : 'standard'
}

export const useDashboardLayout = () => {
  const dashboardLayout = useState('dashboard-layout-mode', () => 'standard')

  const setDashboardLayout = (value) => {
    dashboardLayout.value = normalizeDashboardLayout(value)
  }

  return {
    dashboardLayout,
    setDashboardLayout
  }
}
