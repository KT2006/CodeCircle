function randomMiddleware(req, res, next){
    console.log(`${req.method}, ${req.url}`)
    console.log('middleware was called');
    next()
}

module.exports = randomMiddleware;