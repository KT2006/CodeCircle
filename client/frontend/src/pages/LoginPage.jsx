import React from 'react'
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
  return (
    <>
    <div className="main h-dvh w-dvw flex items-center gap-2 justify-center bg-black flex-col">

        <div className="top flex pt-5.5 items-center gap-1 justify-center">

            <div className="logo-container pt-3  flex items-center" >
            <img className='logo-img bg-cover h-25 w-25 object-cover' src={logo} alt="" />
            </div>

            <h1 className='text-6xl text-white font-semibold' >CodeCircle</h1>

        </div>

        <div className="center text-left flex gap-1 mb-3 text-white flex-col items-center">
            <div className="img-container ">
                <img className='object-cover h-100 w-100' src={fullcircle} alt="" />
            </div>
            <h2 className='text-4xl text-left' >Welcome to <span className='font-semibold' >CodeCircle</span></h2>
            <div className="span-class text-3xl font-semibold">
            <span>Track Progress.</span> <span>Compare.</span> <span>Improve.</span>
            </div>
            <p className='text-2xl' >All in <span className='font-bold' >ONE</span> Circle.</p>
        </div>

        <div className="bottom gap-4 mt-3 text-white flex flex-col items-center justify-center">
           
            <button className='bg-[#3C3F4A] flex text-center items-center gap-7 px-20 border-none rounded-2xl outline-none py-3 border-gray-500 font-semibold text-2xl text-white' > <span> <img className='h-10 w-10' src={google} alt="" /></span> Sign in With Google</button>
           <p className='text-center' > By continuing, you agree to our terms of service and privacy policy </p> 
        </div>

        <div className="bottom-text mt-8 text-white flex items-center justify-center">
        </div>
    </div>
    </>
  )
}

export default LoginPage
