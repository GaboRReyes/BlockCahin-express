const express = require('express')
const axios   = require('axios')
const router  = express.Router()

/**
 * POST /nodes/register
 * FIX #5: acepta el formato documentado en el README: { nodos: ["http://..."] }
 * También acepta { url, nombre } por compatibilidad con versiones anteriores.
 */
router.post('/register', (req, res) => {
  const blockchain = req.app.get('blockchain')

  // Formato principal (README): { nodos: ["http://localhost:8002"] }
  if (Array.isArray(req.body.nodos)) {
    if (req.body.nodos.length === 0) {
      return res.status(400).json({ error: 'El array nodos no puede estar vacío' })
    }

    req.body.nodos.forEach(url => blockchain.registrarNodo(url))

    return res.json({
      mensaje: `${req.body.nodos.length} nodo(s) registrado(s)`,
      nodos: req.body.nodos,
    })
  }

  // Formato alternativo: { url, nombre }
  const { url, nombre } = req.body
  if (!url) {
    return res.status(400).json({ error: 'Falta url o el array nodos' })
  }

  blockchain.registrarNodo(url)
  res.json({ mensaje: 'Nodo registrado', url, nombre })
})

/**
 * GET /nodes/resolve
 * Algoritmo de consenso: adopta la cadena válida más larga de los peers
 */
router.get('/resolve', async (req, res) => {
  const blockchain = req.app.get('blockchain')
  const nodos = blockchain.getNodos()

  if (nodos.length === 0) {
    return res.json({
      mensaje: 'Sin peers registrados, cadena local mantenida',
      reemplazada: false,
    })
  }

  let reemplazada = false

  const consultas = nodos.map(nodo =>
    axios.get(`${nodo}/chain`)
      .then(response => {
        let cadenaRemota = null
        const data = response.data

        if (Array.isArray(data)) {
          cadenaRemota = data
        } else if (data.cadena) {
          cadenaRemota = data.cadena
        } else if (data.chain) {
          cadenaRemota = data.chain
        } else if (data.bloque) {
          console.warn(`[Consenso] Nodo ${nodo} envió un bloque en lugar de cadena`)
          cadenaRemota = [...blockchain.chain, data.bloque]
        }

        if (!cadenaRemota) {
          console.warn(`[Consenso] Nodo ${nodo} devolvió formato inválido`)
          return
        }

        console.log(`[DEBUG CONSENSO] ${nodo} longitud: ${cadenaRemota.length}`)

        if (blockchain.reemplazarCadena(cadenaRemota)) {
          reemplazada = true
          console.log(`[Consenso] Cadena adoptada desde ${nodo}`)
        }
      })
      .catch(err =>
        console.warn(`[Consenso] No se pudo consultar ${nodo}: ${err.message}`)
      )
  )

  await Promise.allSettled(consultas)

  res.json({
    mensaje: reemplazada
      ? 'Cadena reemplazada por una más larga'
      : 'Cadena local es la más larga',
    reemplazada,
    longitud: blockchain.chain.length,
  })
})

/**
 * GET /nodes
 * Lista todos los nodos registrados
 */
router.get('/', (req, res) => {
  const blockchain = req.app.get('blockchain')
  res.json({ nodos: blockchain.getNodos() })
})

module.exports = router