import React from 'react'
import NavBar from '../components/NavBar'
import {BadgeInfo, CodeXml} from 'lucide-react'
import leetcode from '../assets/leetcode.png'
import codeforces from '../assets/codeforces.png'
import codechef from '../assets/codechef.png'
import atcoder from '../assets/atcoder.png'
import {SquarePen, Trophy, Calendar, Flame, CircleCheck} from 'lucide-react'
import InputComponent from '../components/InputComponent'
import StatsBox from '../components/StatsBox'
import StatsDiagramBox from '../components/StatsDiagramBox'
import { PieChart, Pie, Tooltip } from 'recharts'
import PlatformDonuts from '../components/PlatformDonuts'
import { platformData, PLATFORM_COLORS } from '../data/platformData'
import ProgressBar from '../components/ProgressBar'
import HeatMap from '../components/HeatMap'
const ProfilePage = () => {
  return (
    <>
      <NavBar></NavBar>
      <div className="main flex gap-6 bg-[#050816] h-dvh w-dvw flex-col">

        <div className="upper flex px-8 py-3 justify-around text-white border-1 border-[#1E2A45] bg-[#0C1324] rounded-2xl h-45 w-full ">

          <div className="left flex gap-20">

            <div className="left-left-section flex flex-col items-center gap-2">
              {/* image container banega => user will upload his avatar in here */}
            <div className="h-25 w-25 rounded-full bg-red-900">

            </div>
              <SquarePen size={18}></SquarePen>
            </div>
            <div className="right-section flex flex-col gap-1">

                <h1 className='text-2xl' >Kshitij Totawar</h1>
                <h3 className='text-sm'>full stack developer & competitive programmer</h3>
                <div className="composite-section flex gap-2">
                <h3 className='font-semibold' >Composite Score </h3>
                <span><BadgeInfo /></span>
                </div>
                <div className="score-section flex gap-4 items-center mb-1">
                  <h1 className='text-purple-500 text-4xl text-start' >2006</h1>
                  <h3 className='text-center border border-purple-400 rounded-md bg-purple-400/80 text-white font-semibold py-0.5 px-1 text-sm'>Top 7%</h3>
                </div>
                  <h3 className='text-sm'>of all tracked users</h3>

            </div>
          </div>

          <div className="upper-right flex items-center justify-evenly flex-col">
            {/* add platform icons and their names in here */}
            <div className="platform-txt-area flex gap-4 flex-col">
              {/* do-do input areas ko seprate kara bas */}
               <div className="top flex gap-15">
                
                 <InputComponent img = {leetcode} ></InputComponent>

                 <InputComponent img = {codeforces} ></InputComponent>
               </div>
                
                <div className="bottom flex gap-15 ">
                 <InputComponent img = {codechef} ></InputComponent>
                 <InputComponent img = {atcoder} ></InputComponent>
                    
                </div>
            </div>
          </div>
      
       </div>


        <div className="second  text-white flex items-center justify-evenly px-2">

            <StatsBox h1={1248} h2= "Problems Solved" h3 = "All platforms" icon = {<CodeXml/>} ></StatsBox>
            <StatsBox h1={1248} h2= "Problems Solved" h3 = "All platforms" icon ={<Trophy />}  ></StatsBox>
            <StatsBox h1={1248} h2= "Problems Solved" h3 = "All platforms" icon = {<Calendar/>} ></StatsBox>
            <StatsBox h1={1248} h2= "Problems Solved" h3 = "All platforms" icon ={<Flame />} ></StatsBox>
            <StatsBox h1={1248} h2= "Problems Solved" h3 = "All platforms" icon ={<CircleCheck />} ></StatsBox>
            <StatsBox h1={1248} h2= "Problems Solved" h3 = "All platforms" icon = {<Calendar/>} ></StatsBox>

    
        </div>

        <div className="center px-5 border-[#1E2A45] flex gap-5 ">
          <StatsDiagramBox
            // children ko pass karne se accha props ki tarah pass kar you'll have much more control over it
            title ={<h3 className='font-semibold' >Platform Contribution</h3>}
            subtitle = {<p className='text-xs' > Where your problem solving happens</p>}
            chart = {<PlatformDonuts></PlatformDonuts>}
            right = {
                platformData.map((entry) => (
                  <ProgressBar  key={entry.name} name = {entry.name} ></ProgressBar>
                ))
            }
          />
            
          
          <StatsDiagramBox></StatsDiagramBox>
        </div>



        <div className="last px-5  flex gap-5">  
          <StatsDiagramBox
            right = {<HeatMap></HeatMap>}
          ></StatsDiagramBox>
          <StatsDiagramBox></StatsDiagramBox>
        </div>

      </div>
    </>
  )
}

export default ProfilePage
