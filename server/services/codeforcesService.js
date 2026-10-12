// we need to use something called as fetch to fetch the data from any given url

const codeforcesData = async (handle) =>{
    //handle is the username of the user

   try{
     //we need the url first
    const url  = `https://codeforces.com/api/user.info?handles=${handle}`;
    //now we need to hit the url
    const response = await fetch(url); //we need to make sure we are waiting until the response arrives
    //now reponse has arrive, we need to make sure we are parsing it into json format
    const userInfo = await response.json();

    //now we need to check if the response has actuall arrived or not

  if (userInfo.status !== 'OK') {
      throw new Error(`Codeforces user "${handle}" not found`)
    }


     // STEP 2 — fetch submissions to calculate problems solved
    const submissionsResponse = await fetch(
      `https://codeforces.com/api/user.status?handle=${handle}&from=1&count=10000`
    )
    const submissionsData = await submissionsResponse.json()

    // STEP 3 — fetch contest history for rating progression
    const ratingsResponse = await fetch(
      `https://codeforces.com/api/user.rating?handle=${handle}`
    )
    const ratingsData = await ratingsResponse.json()

    console.log(userInfo); //if the userInfo has been found
    console.log(submissionsData)
    console.log(ratingsData)
   }catch(err){
    console.error('error occured:', err.message);
   }
}

codeforcesData('kshitij_21');

module.exports = {codeforcesData}