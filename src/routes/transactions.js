const express = require('express')
const axios = require('axios')
const router = express.Router()
const { v4: uuidv4 } = require('uuid')

/**
 * POST /transactions
 * Recibe una transacción, la agrega a pendientes y la propaga a los peers.
 * Header X-Propagated: true evita re-propagación infinita.
 */
router.post('/', async (req, res) => {
  const blockchain = req.app.get('blockchain')
  const propagado = req.headers['x-propagated'] === 'true'

  // Validar campos requeridos (fecha_inicio es opcional)
  const camposRequeridos = ['persona_id', 'institucion_id', 'programa_id', 'titulo_obtenido', 'fecha_fin']
  const faltantes = camposRequeridos.filter(c => !req.body[c])
  if (faltantes.length > 0) {
    return res.status(400).json({ error: `Campos requeridos: ${faltantes.join(', ')}` })
  }

  const tx = {
    id: req.body.id || uuidv4(),  // respetar id si viene de propagación
    persona_id: req.body.persona_id,
    institucion_id: req.body.institucion_id,
    programa_id: req.body.programa_id,
    titulo_obtenido: req.body.titulo_obtenido,
    fecha_inicio: req.body.fecha_inicio || null,
    fecha_fin: req.body.fecha_fin,
    numero_cedula: req.body.numero_cedula || null,
    titulo_tesis: req.body.titulo_tesis || null,
    menciones: req.body.menciones || null,
    firmado_por: req.body.firmado_por || null,
    creado_en: req.body.creado_en || new Date().toISOString(),
  }

  const resultado = blockchain.agregarTransaccion(tx)
  if (!resultado) {
    return res.status(200).json({ mensaje: 'Transacción ya registrada (duplicado ignorado)', id: tx.id })
  }

  blockchain.transaccionesPendientes.push(tx)
  console.log(`[Transaccion] Nueva transacción agregada: ${tx.id} (propagado=${propagado})`)

  // Solo propagar si esta tx llegó directo del cliente (no de un peer)
  if (!propagado) {
    const PORT = process.env.PORT || 8002
    const nodos = blockchain.getNodos().filter(n => {
      // FIX: nunca propagarse a sí mismo
      const normalizado = n.replace(/\/$/, '')
      return normalizado !== `http://localhost:${PORT}`
        && normalizado !== `http://127.0.0.1:${PORT}`
    })

    const propagaciones = nodos.map(nodo =>
      axios.post(`${nodo}/transactions`, tx, {
        headers: { 'X-Propagated': 'true' },
        timeout: 3000,  // no esperar indefinidamente si un nodo está caído
      }).catch(err =>
        console.warn(`[Propagacion Transacción] Fallo nodo ${nodo}: ${err.message}`)
      )
    )
    await Promise.allSettled(propagaciones)
  }

  res.status(201).json({
    mensaje: 'Transacción agregada',
    transaccion: tx,
    propagada: !propagado,
    indiceBloque: blockchain.chain.length,
  })
})

/**
 * GET /transactions/pending
 * Devuelve las transacciones pendientes de minar
 */
router.get('/pending', (req, res) => {
  const blockchain = req.app.get('blockchain')
  res.json({ transacciones: blockchain.transaccionesPendientes })
})

module.exports = router