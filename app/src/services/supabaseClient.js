import { createClient } from '@supabase/supabase-js'

const nodeEnv =
  typeof globalThis !== 'undefined' && globalThis.process?.env ? globalThis.process.env : {}

const runtimeEnv =
  (typeof import.meta !== 'undefined' && import.meta.env) || {
    VITE_SUPABASE_URL: nodeEnv.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: nodeEnv.VITE_SUPABASE_ANON_KEY,
    VITE_SUPABASE_STORAGE_BUCKET: nodeEnv.VITE_SUPABASE_STORAGE_BUCKET,
  }

const supabaseUrl = runtimeEnv?.VITE_SUPABASE_URL
const supabaseAnonKey = runtimeEnv?.VITE_SUPABASE_ANON_KEY

const missingEnv = !supabaseUrl || !supabaseAnonKey

export const supabase = missingEnv
  ? new Proxy(
      {},
      {
        get() {
          throw new Error(
            'Supabase client is not configured. Copy .env.example to .env.local ' +
              'and set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.',
          )
        },
      },
    )
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

export const getStorageBucket = () =>
  runtimeEnv?.VITE_SUPABASE_STORAGE_BUCKET || 'pricing-engine-uploads'

