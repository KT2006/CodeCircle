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
 * Modal for adding a new friend with CodeCircle theme.
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

  const handleClose = () => {
    reset()
    onClose?.()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!displayName.trim()) {
      setNameError('A display name is required.')
      return
    }
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
      className="cc-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) handleClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cc-add-friend-title"
    >
      <div className="cc-modal-box">
        {/* Header */}
        <div className="cc-modal-header">
          <div>
            <h2 id="cc-add-friend-title">Add a Friend</h2>
            <p>
              Enter a name and at least one platform handle. We&apos;ll fetch their profile instantly.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="cc-modal-close"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="cc-modal-body">
          {/* Display name */}
          <div>
            <label className="cc-field-label" htmlFor="friend-name">
              Display Name <span className="req">*</span>
            </label>
            <input
              id="friend-name"
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value)
                setNameError('')
              }}
              placeholder="e.g. Rahul"
              maxLength={60}
              disabled={loading}
              className="cc-input"
              autoFocus
            />
            {nameError && (
              <p style={{ color: 'var(--hot)', fontSize: 12, margin: '5px 0 0' }}>
                {nameError}
              </p>
            )}
          </div>

          {/* Platform handles */}
          <div>
            <span className="cc-field-label">
              Platform Handles <span className="sub">(at least one)</span>
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PLATFORMS.map(({ key, label, icon, placeholder }) => (
                <div key={key} className="cc-platform-row">
                  <div className="cc-platform-badge" title={label}>
                    <img src={icon} alt={label} />
                  </div>
                  <input
                    type="text"
                    value={handles[key]}
                    onChange={(e) =>
                      setHandles(prev => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={placeholder}
                    maxLength={50}
                    aria-label={`${label} handle`}
                    disabled={loading}
                    className="cc-input"
                  />
                  {handles[key] && !loading && (
                    <button
                      type="button"
                      onClick={() => setHandles(prev => ({ ...prev, [key]: '' }))}
                      className="cc-platform-clear"
                      aria-label={`Clear ${label} handle`}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Submit error */}
          {submitError && (
            <p className="cc-modal-error">{submitError}</p>
          )}

          {/* Loading hint */}
          {loading && (
            <p style={{ color: 'var(--mute)', fontSize: 13, margin: 0 }}>
              Fetching platform profiles… this may take a few seconds.
            </p>
          )}

          {/* Footer buttons */}
          <div className="cc-modal-footer">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="cc-btn-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="cc-btn-primary"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Fetching…
                </>
              ) : (
                <>
                  <Plus size={16} strokeWidth={2.5} /> Add Friend
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddFriendModal
