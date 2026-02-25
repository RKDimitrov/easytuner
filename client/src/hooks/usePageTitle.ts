import { useEffect } from 'react'

export function usePageTitle(page?: string) {
  useEffect(() => {
    document.title = page ? `EasyTuner - ${page}` : 'EasyTuner'
    return () => {
      document.title = 'EasyTuner'
    }
  }, [page])
}
