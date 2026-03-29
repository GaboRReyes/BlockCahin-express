const express = require('express')
const axios   = require('axios')
const router  = express.Router()
const { v4: uuidv4 } = require('uuid')

/**
 * POST /transactions
 * Recibe una transacción, la agrega a pendientes y la propaga a los peers
 * Header X-Propagated: true evita re-propagación infinita
 */
router.post('/', async (req, res) => {
  const blockchain = req.app.get('blockchain')
  const propagado  = req.headers['x-propagated'] === 'true'

  // Validar campos requeridos
  const camposRequeridos = ['persona_id', 'institucion_id', 'programa_id', 'titulo_obtenido', 'fecha_inicio', 'fecha_fin']
  const faltantes = camposRequeridos.filter(c => !req.body[c])
  if (faltantes.length > 0) {
    return res.status(400).json({ error: `Campos requeridos: ${faltantes.join(', ')}` })
  }

  // Construir transacción en snake_case
  const tx = {
    id: uuidv4(),
    persona_id: req.body.persona_id,
    institucion_id: req.body.institucion_id,
    programa_id: req.body.programa_id,
    titulo_obtenido: req.body.titulo_obtenido,
    fecha_inicio: req.body.fecha_inicio,
    fecha_fin: req.body.fecha_fin,
    numero_cedula: req.body.numero_cedula || null,
    titulo_tesis: req.body.titulo_tesis || null,
    menciones: req.body.menciones || null,
    firmado_por: req.body.firmado_por || null,
    creado_en: new Date().toISOString()
  }

  // Agregar transacción a pendientes
  blockchain.transaccionesPendientes.push(tx)

  // Propagar a otros nodos si no viene propagado
  if (!propagado) {
    const nodos = blockchain.getNodos()
    const propagaciones = nodos.map(nodo =>
      axios.post(`${nodo}/transactions`, tx, { headers: { 'X-Propagated': 'true' } })
        .catch(err => console.warn(`[Propagacion Transacción] Fallo nodo ${nodo}: ${err.message}`))
    )
    await Promise.allSettled(propagaciones)
  }

  res.status(201).json({
    mensaje: 'Transacción agregada',
    transaccion: tx,
    propagada: !propagado,
    indiceBloque: blockchain.chain.length
  })
})

/**
 * GET /transactions/pending
 * Devuelve las transacciones pendientes
 */
router.get('/pending', (req, res) => {
  const blockchain = req.app.get('blockchain')
  res.json({ transacciones: blockchain.transaccionesPendientes })
})

module.exports = router 