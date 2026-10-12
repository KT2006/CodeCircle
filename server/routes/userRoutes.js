const express = require('express')
const router = express.Router();

router.get('/profile', checkGoogle)
router.post('/profile', checkCallback)
router.get('/stats', getMe)


module.exports = router