import { useState } from 'react'
import { Loader2, Plus, Trash2, X } from 'lucide-react'
import leetcode        from '../../assets/leetcode.png'
import codeforces      from '../../assets/codeforces.png'
import codechef        from '../../assets/codechef.png'
import atcoder         from '../../assets/atcoder.png'
import geeksforgeeks   from '../../assets/geeksforgeeks.svg'

const PLATFORMS = [
  { key: 'codeforces',    label: 'Codeforces',    icon: codeforces,    placeholder: 'e.g. tourist'  },
  { key: 'leetcode',      label: 'LeetCode',      icon: leetcode,      placeholder: 'e.g. neal_wu'  },
  { key: 'codechef',      label: 'CodeChef',      icon: codechef,      placeholder: 'e.g. gennady'  },
  { key: 'atcoder',       label: 'AtCoder',        icon: atcoder,       placeholder: 'e.g. uwi_tkt'  },
  { key: 'geeksforgeeks', label: 'GeeksForGeeks',  icon: geeksforgeeks, placeholder: 'e.g. rahul_gfg' },
]

const EMPTY_HANDLES = () => Object.fromEntries(PLATFORMS.map(p => [p.key, '']))

/**
 * Modal for adding a new friend.
 *
 * Props:
 *   open     – boolean
 *   onClose  – () => void
 *   onSubmit – (payload, { onError, onSuccess }) => void
 *     payload = { displayName: string, handles: { platform: handle } }
 */
const AddFriendModal = ({ open, onClose, onSubmit }) => {
  const [displayName, setDisplayName] = useState('')
  const [handles,     setHandles]     = useState(EMPTY_HANDLES())
  const [nameError,   setNameError]   = useState('')
  const [submitError, setSubmitError] = useState('')
  const [loading,     setLoading]     = useState(false)

  if (!open) return null

  const filledHandles = Object.entries(handles).filter(([, v]) => v.trim() !== '')
  const canSubmit = !loading && displayName.trim().length > 0 && filledHandles.length > 0

  const reset = () => {
    setDisplayName('')
    setHandles(EMPTY_HANDLES())
    setNameError('')
    setSubmitError('')
    setLoading(false)
  }

  const handleClose = () => { reset(); onClose?.() }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!displayName.trim()) { setNameError('A display name is required.'); return }
    if (filledHandles.length === 0) return

    setLoading(true)
    setSubmitError('')

    onSubmit?.(
      {
        displayName: displayName.trim(),
        handles: Object.fromEntries(filledHandles.map(([k, v]) => [k, v.trim()])),
      },
      {
        onError: (msg) => {
          setSubmitError(msg)
          setLoading(false)
        },
        onSuccess: () => {
          reset()
          onClose?.()
        },
      }
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(14,21,39,0.99),rgba(9,14,28,0.99))] shadow-[0_24px_64px_rgba(0,0,0,0.6)]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">Add a Friend</h2>
            <p className="text-xs text-slate-400">
              Enter a name and at least one platform handle. We'll fetch their profile instantly.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-white/8 hover:text-white disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">

          {/* Display name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300" htmlFor="friend-name">
              Display Name <span className="text-rose-400">*</span>
            </label>
            <input
              id="friend-name"
              type="text"
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); setNameError('') }}
              placeholder="e.g. Rahul"
              maxLength={60}
              disabled={loading}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50"
            />
            {nameError && <p className="text-xs text-rose-400">{nameError}</p>}
          </div>

          {/* Platform handles */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-300">
              Platform Handles <span className="text-slate-500">(at least one)</span>
            </p>
            <div className="space-y-2">
              {PLATFORMS.map(({ key, label, icon, placeholder }) => (
                <div key={key} className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/6">
                    <img src={icon} alt={label} className="h-4 w-4 object-contain opacity-80" />
                  </div>
                  <input
                    type="text"
                    value={handles[key]}
                    onChange={(e) => setHandles(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    maxLength={50}
                    aria-label={`${label} handle`}
                    disabled={loading}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50"
                  />
                  {handles[key] && !loading && (
                    <button
                      type="button"
                      onClick={() => setHandles(prev => ({ ...prev, [key]: '' }))}
                      className="shrink-0 text-slate-500 transition-colors hover:text-rose-400"
                      aria-label={`Clear ${label} handle`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Submit error */}
          {submitError && (
            <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{submitError}</p>
          )}

          {/* Loading hint */}
          {loading && (
            <p className="text-xs text-slate-400">
              Fetching platform profiles… this may take a few seconds.
            </p>
          )}

          {/* Footer */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Fetching…</>
                : <><Plus className="h-4 w-4" /> Add Friend</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddFriendModal
