const express = require('express')
const axios   = require('axios')
const router  = express.Router()

router.post('/', async (req, res) => {
  const blockchain = req.app.get('blockchain')

  try {
    const { bloque, bloqueParaPropagar } = await blockchain.minar(process.env.NODE_ID || 'nodo-1')

    const nodos = blockchain.getNodos()

    console.log('[Propagacion] JSON que se enviará:', JSON.stringify({ bloque: bloqueParaPropagar }, null, 2))

    await Promise.allSettled(
      nodos.map(nodo =>
        axios.post(`${nodo}/blocks/receive`, { bloque: bloqueParaPropagar }, {
          headers: { 'X-Propagated': 'true' },
          timeout: 3000,
        }).catch(err => console.warn(`[Propagacion Bloque] Fallo nodo ${nodo}: ${err.message}`))
      )
    )

    res.json({ mensaje: 'Bloque minado', bloque })

  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

module.exports = router