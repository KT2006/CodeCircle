const express = require('express')
const router = express.Router();

router.get('/', checkGoogle)
router.post('/', checkCallback)
router.delete('/:friendIndex', getMe)


module.exports = router