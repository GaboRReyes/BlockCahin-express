const express = require('express')
const axios   = require('axios')
const router  = express.Router()

// Convierte el formato externo (aplanado, snake_case) al formato interno
function normalizarBloqueexterno(bloque) {
    
  // Si ya tiene data.transacciones, es formato interno — no tocar
  if (bloque.data?.transacciones) return bloque

  // Formato externo
  const tx = {
    id:             bloque.id,
    persona_id:     bloque.persona_id,
    institucion_id: bloque.institucion_id,
    programa_id:    bloque.programa_id,
    titulo_obtenido:bloque.titulo_obtenido,
    fecha_inicio:   bloque.fecha_inicio   || null,
    fecha_fin:      bloque.fecha_fin      || null,
    numero_cedula:  bloque.numero_cedula  || null,
    titulo_tesis:   bloque.titulo_tesis   || null,
    menciones:      bloque.menciones      || null,
    firmado_por:    bloque.firmado_por    || null,
    creado_en:      bloque.creado_en      || new Date().toISOString(),
  }

  return {
    index:         bloque.index        ?? null,
    timestamp:     bloque.timestamp    ?? Date.now(),
    hash_actual:   bloque.hash_actual,
    hash_anterior: bloque.hash_anterior,
    nonce:         bloque.nonce        ?? 0,
    data: {
      transacciones: [tx],
      minado_por: bloque.firmado_por || 'externo',
    }
  }
}

// POST /blocks/receive
router.post('/receive', async (req, res) => {
  const blockchain = req.app.get('blockchain')
  const bloqueRaw  = req.body.bloque
  const propagado  = req.headers['x-propagated'] === 'true'

  if (!bloqueRaw) {
    return res.status(400).json({ error: 'Bloque inválido: falta body.bloque' })
  }

  const bloque = normalizarBloqueexterno(bloqueRaw)

  if (!bloque.hash_actual) {
    return res.status(400).json({ error: 'Bloque inválido: falta hash_actual' })
  }

  // Verificar encadenamiento
  const ultimo = blockchain.ultimoBloque
  if (bloque.hash_anterior !== ultimo.hash_actual) {
    return res.status(409).json({ error: 'Conflicto de cadena' })
  }

  blockchain.chain.push(bloque)
  blockchain.transaccionesPendientes = blockchain.transaccionesPendientes.filter(
    tx => !bloque.data.transacciones.some(btx => btx.id === tx.id)
  )

  const { persistirBloque } = require('../db/grados')
  try {
    await persistirBloque(bloque, process.env.NODE_ID || 'nodo-1')
  } catch (err) {
    console.error('[Receive] Error persistiendo:', err.message)
  }

  if (!propagado) {
    const nodos = blockchain.getNodos()
    await Promise.allSettled(
      nodos.map(nodo =>
        axios.post(`${nodo}/blocks/receive`, { bloque }, { headers: { 'X-Propagated': 'true' } })
          .catch(err => console.warn(`[Propagacion Bloque] Fallo nodo ${nodo}: ${err.message}`))
      )
    )
  }

  res.json({ mensaje: 'Bloque recibido y agregado' })
})

module.exports = router