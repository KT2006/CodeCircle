const express = require('express')
const router = express.Router();

router.get('/user', checkGoogle)
router.get('/friend/:friendIndex', checkCallback)


module.exports = router