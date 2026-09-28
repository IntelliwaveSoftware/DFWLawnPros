import { USE_MOCK_API } from '@/config/env'
import { httpApi } from './httpApi'
import { mockApi } from './mock/mockApi'
import type { Api } from './types'

export const api: Api = USE_MOCK_API ? mockApi : httpApi
export * from './types'
