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

// GET /chain/reset
router.post('/reset', (req, res) => {
  const blockchain = req.app.get('blockchain')
  blockchain.resetearCadena()

  res.json({ mensaje: 'Blockchain reiniciada' })
})
module.exports = router 
