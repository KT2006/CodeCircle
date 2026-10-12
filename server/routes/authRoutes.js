const express = require('express')
const router = express.Router();

router.get('/google', checkGoogle)
router.get('/google/callback', checkCallback)
router.get('/me', getMe)
router.post('/logout', logOut)

module.exports = router