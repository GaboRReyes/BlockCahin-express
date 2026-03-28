const express = require('express')
const axios   = require('axios')
const router  = express.Router()


router.post('/', async (req, res) => {
  const blockchain = req.app.get('blockchain')
  const nodeId     = process.env.NODE_ID || 'nodo-desconocido'

  try {
    const bloque = blockchain.minar(nodeId)

    // Propagar bloque minado a todos los peers
    const nodos = blockchain.getNodos()
    const propagaciones = nodos.map(async (nodo) => {
  try {
    await axios.post(`${nodo}/nodes/block`, { bloque }, {
      headers: { 'X-Propagated': 'true' }
    })

  } catch (err) {
    if (err.response?.status === 409) {
      console.warn(`[Consenso] Conflicto detectado con ${nodo}, resolviendo cadena...`)

      try {
        await axios.get(`${nodo}/nodes/resolve`)
        console.log(`[Consenso] Nodo sincronizado con ${nodo}`)
      } catch (resolveErr) {
        console.warn(`[Consenso] Error resolviendo con ${nodo}: ${resolveErr.message}`)
      }

    } else {
      console.warn(`[Propagacion] Fallo nodo ${nodo}: ${err.message}`)
    }
  }
})
    await Promise.allSettled(propagaciones)

    res.json({
      mensaje:    'Bloque minado y propagado',
      bloque,
      nodosMine:  nodeId,
      propagadoA: nodos,
    })

    
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

module.exports = router
