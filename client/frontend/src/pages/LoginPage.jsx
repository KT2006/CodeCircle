import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import logo from '../assets/logo.png'
import fullcircle from '../assets/full_circle.png'
import google from '../assets/google.png'

// const LoginPage = () => {
//     return (
//       <div className="min-h-dvh w-dvw flex flex-col items-center justify-center bg-[#0A0A0F] gap-6 py-10">
  
//         {/* Logo + Title */}
//         <div className="flex items-center gap-3">
//           <img className="h-12 w-12 object-contain" src={logo} alt="logo" />
//           <h1 className="text-5xl text-white font-semibold">CodeCircle</h1>
//         </div>
  
//         {/* Circle Image */}
//         <img className="h-72 w-72 object-contain" src={fullcircle} alt="circle" />
  
//         {/* Text Block */}
//         <div className="flex flex-col items-center gap-2 text-white text-center">
//           <h2 className="text-3xl">
//             Welcome to <span className="font-semibold">CodeCircle</span>
//           </h2>
//           <p className="text-2xl font-semibold">
//             Track Progress. Compare. Improve.
//           </p>
//           <p className="text-2xl">
//             All in <span className="font-bold">ONE</span> Circle.
//           </p>
//         </div>
  
//         {/* Google Button */}
//         <button className="flex items-center gap-4 bg-[#3C3F4A] text-white font-semibold text-xl px-16 py-3 rounded-2xl">
//           <img className="h-8 w-8" src={google} alt="google" />
//           Sign in With Google
//         </button>
  
//         {/* Footer Text */}
//         <p className="text-white text-sm opacity-60">
//           By continuing, you agree to our terms of service and privacy policy
//         </p>
  
//       </div>
//     )
//   }
const LoginPage = () => {
  const [isGoogleReady, setIsGoogleReady] = useState(false)
  const navigate = useNavigate()
  const { googleClientId, error, isLoading, setError, signInWithGoogle } = useAuth()

  useEffect(() => {
    if (!googleClientId || isLoading) return undefined

    let cancelled = false
    const initializeGoogleSignIn = () => {
      if (cancelled || !window.google?.accounts?.id) return

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          if (!credential) {
            setError('Google sign-in did not return a credential. Please try again.')
            return
          }
          try {
            await signInWithGoogle(credential)
            navigate('/profile', { replace: true })
          } catch (signInError) {
            setError(signInError instanceof Error ? signInError.message : 'Google sign-in failed.')
          }
        },
      })
      setIsGoogleReady(true)
    }

    const script = document.getElementById('google-identity-services')
    if (window.google?.accounts?.id) {
      initializeGoogleSignIn()
    } else if (script) {
      script.addEventListener('load', initializeGoogleSignIn)
    } else {
      const googleScript = document.createElement('script')
      googleScript.id = 'google-identity-services'
      googleScript.src = 'https://accounts.google.com/gsi/client'
      googleScript.async = true
      googleScript.defer = true
      googleScript.addEventListener('load', initializeGoogleSignIn)
      googleScript.addEventListener('error', () => {
        if (!cancelled) setError('Google sign-in could not be loaded. Check your connection and try again.')
      }, { once: true })
      document.head.appendChild(googleScript)
    }

    return () => {
      cancelled = true
      script?.removeEventListener('load', initializeGoogleSignIn)
    }
  }, [googleClientId, isLoading, navigate, setError, signInWithGoogle])

  const handleGoogleSignIn = () => {
    if (!isGoogleReady || !window.google?.accounts?.id) {
      setError('Google sign-in is still loading. Please try again in a moment.')
      return
    }

    setError('')
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed()) {
        setError('Google sign-in could not be displayed. Check your browser settings and try again.')
      } else if (notification.isSkippedMoment()) {
        setError('Google sign-in was closed before completing.')
      }
    })
  }

  return (
    <>
    <div className="main flex min-h-dvh w-full flex-col items-center justify-center gap-2 overflow-x-hidden bg-black px-4 py-8">

        <div className="top flex max-w-full items-center justify-center gap-1 pt-5.5">

            <div className="logo-container pt-3  flex items-center" >
            <img className='logo-img h-16 w-16 bg-cover object-cover sm:h-25 sm:w-25' src={logo} alt="" />
            </div>

            <h1 className='text-4xl font-semibold text-white sm:text-6xl' >CodeCircle</h1>

        </div>

        <div className="center text-left flex gap-1 mb-3 text-white flex-col items-center">
            <div className="img-container ">
                <img className='h-auto max-h-[40vh] w-[min(80vw,25rem)] object-contain sm:max-h-none' src={fullcircle} alt="" />
            </div>
            <h2 className='text-center text-2xl sm:text-4xl' >Welcome to <span className='font-semibold' >CodeCircle</span></h2>
            <div className="span-class text-center text-lg font-semibold sm:text-3xl">
            <span>Track Progress.</span> <span>Compare.</span> <span>Improve.</span>
            </div>
            <p className='text-xl sm:text-2xl' >All in <span className='font-bold' >ONE</span> Circle.</p>
        </div>

        <div className="bottom mt-3 flex w-full max-w-sm flex-col items-center justify-center gap-4 text-white">
            {googleClientId
              ? (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={!isGoogleReady}
                  className="flex w-full items-center justify-center gap-4 rounded-2xl border border-gray-500 bg-[#3C3F4A] px-8 py-3 text-xl font-semibold text-white outline-none transition-colors hover:bg-[#4a4d58] disabled:cursor-wait disabled:opacity-70 sm:px-12 sm:text-2xl"
                >
                  <img className="h-8 w-8 shrink-0 sm:h-10 sm:w-10" src={google} alt="" />
                  <span>Sign in With Google</span>
                </button>
              )
              : <p className="text-center text-sm text-amber-200">
                {isLoading ? 'Loading sign-in…' : 'Google sign-in is not configured.'}
              </p>}
            {error && <p role="alert" className="text-center text-sm text-rose-300">{error}</p>}
            <p className='text-center text-sm' > By continuing, you agree to our terms of service and privacy policy </p>
        </div>

        <div className="bottom-text mt-8 text-white flex items-center justify-center">
        </div>
    </div>
    </>
  )
}

export default LoginPage
