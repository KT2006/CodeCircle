const randomMiddleware = require('./middleware/sample');
const express = require('express')
const cors = require('cors')
const authRoutes = require('./routes/authRoutes')
const userRoutes = require('./routes/userRoutes')
const friendsRoutes = require('./routes/friendsRoutes')
const feedRoutes = require('./routes/feedRoutes')
const compareRoutes = require('./routes/compareRoutes')
const refreshRoutes = require('./routes/refreshRoutes')

const app = express();

app.use(express.json())

app.use('/api/auth', authRoutes)

// Protected routes — verifyToken runs before all of these
app.use('/api/user',    verifyToken, userRoutes)
app.use('/api/friends', verifyToken, friendsRoutes)
app.use('/api/refresh', verifyToken, refreshRoutes)
app.use('/api/compare', verifyToken, compareRoutes)
app.use('/api/feed',    verifyToken, feedRoutes)

app.listen(3000, ()=>{
    console.log('app running on port 3000')
})

