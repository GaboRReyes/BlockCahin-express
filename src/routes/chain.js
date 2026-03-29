const express = require('express')
const router  = express.Router()

/**
 * GET /chain
 * Retorna la cadena completa y su longitud
 */
// GET /chain
router.get('/', (req, res) => {
  const blockchain = req.app.get('blockchain')
  res.json({ longitud: blockchain.chain.length, cadena: blockchain.chain })
})

module.exports = router 
