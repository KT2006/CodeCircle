const express = require('express')
const router = express.Router();

router.get('/feed', checkGoogle)
router.get('/feed?date=', checkCallback)


module.exports = router