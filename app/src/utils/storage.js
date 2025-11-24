const LATEST_PROJECT_KEY = 'afforda_latest_project'

export const saveLatestProjectId = (projectId) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LATEST_PROJECT_KEY, projectId)
  window.dispatchEvent(
    new CustomEvent('afforda:project-change', {
      detail: { projectId },
    }),
  )
}

export const getLatestProjectId = () => {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(LATEST_PROJECT_KEY)
}

