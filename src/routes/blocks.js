const express = require('express')
const axios   = require('axios')
const router  = express.Router()

// Convierte el formato externo al formato interno
function normalizarBloqueExterno(bloque) {

  // Si ya tiene data.transacciones, es formato interno — normalizar transacciones
  if (bloque.data?.transacciones) {
    bloque.data.transacciones = bloque.data.transacciones.map(tx => ({
      ...tx,
      id: tx.id ?? null, // los nodos externos pueden no mandar id
    }))
    // Normalizar minado_por / minadoPor
    if (!bloque.data.minado_por && bloque.data.minadoPor) {
      bloque.data.minado_por = bloque.data.minadoPor
    }
    return bloque
  }

  // Formato externo aplanado (un solo grado en el bloque)
  const tx = {
    id:             bloque.id             ?? null,
    persona_id:     bloque.persona_id,
    institucion_id: bloque.institucion_id,
    programa_id:    bloque.programa_id    ?? null,
    titulo_obtenido:bloque.titulo_obtenido,
    fecha_inicio:   bloque.fecha_inicio   ?? null,
    fecha_fin:      bloque.fecha_fin      ?? null,
    numero_cedula:  bloque.numero_cedula  ?? null,
    titulo_tesis:   bloque.titulo_tesis   ?? null,
    menciones:      bloque.menciones      ?? null,
    firmado_por:    bloque.firmado_por    ?? null,
    creado_en:      bloque.creado_en      ?? new Date().toISOString(),
  }

  return {
    index:         bloque.index        ?? null,
    timestamp:     bloque.timestamp    ?? Date.now(),
    hash_actual:   bloque.hash_actual,
    hash_anterior: bloque.hash_anterior,
    nonce:         bloque.nonce        ?? 0,
    data: {
      transacciones: [tx],
      minado_por:    bloque.firmado_por || 'externo',
    }
  }
}

// POST /blocks/receive
router.post('/receive', async (req, res) => {
  const blockchain = req.app.get('blockchain')
  const propagado  = req.headers['x-propagated'] === 'true'

  const bloqueRaw = req.body.bloque ?? req.body

  console.log('[Receive] Body recibido:', JSON.stringify(req.body, null, 2))

  if (!bloqueRaw || !bloqueRaw.hash_actual) {
    return res.status(400).json({ error: 'Bloque inválido: falta hash_actual' })
  }

  const bloque = normalizarBloqueExterno(bloqueRaw)

  // Deduplicar: si el bloque ya está en la cadena, ignorarlo
  const yaExiste = blockchain.chain.some(b => b.hash_actual === bloque.hash_actual)
  if (yaExiste) {
    return res.status(200).json({ mensaje: 'Bloque ya existe en la cadena (duplicado ignorado)' })
  }

  // Verificar encadenamiento
  const ultimo = blockchain.ultimoBloque
  if (bloque.hash_anterior !== ultimo.hash_actual) {
    console.warn(`[Receive] Conflicto de cadena — esperado: ${ultimo.hash_actual} | recibido hash_anterior: ${bloque.hash_anterior}`)
    return res.status(409).json({ error: 'Conflicto de cadena' })
  }

  blockchain.chain.push(bloque)

  // Limpiar del mempool las tx que ya vienen en este bloque
  blockchain.transaccionesPendientes = blockchain.transaccionesPendientes.filter(
    tx => !bloque.data.transacciones.some(btx => btx.id && btx.id === tx.id)
  )

  const { persistirBloque } = require('../db/grados')
  try {
    await persistirBloque(bloque, process.env.NODE_ID || 'nodo-1')
  } catch (err) {
    console.error('[Receive] Error persistiendo:', err.message)
  }

  // Propagar en formato aplanado compatible con todos los nodos
  if (!propagado) {
    const tx = bloque.data.transacciones[0] ?? {}
    const bloqueParaPropagar = {
      index:         bloque.index,
      timestamp:     bloque.timestamp,
      hash_actual:   bloque.hash_actual,
      hash_anterior: bloque.hash_anterior,
      nonce:         bloque.nonce,
      firmado_por:   bloque.data.minado_por || 'externo',
      data: {
        minadoPor:     bloque.data.minado_por || 'externo',
        transacciones: bloque.data.transacciones.map(t => ({
          persona_id:     t.persona_id,
          institucion_id: t.institucion_id,
          programa_id:    t.programa_id    ?? null,
          titulo_obtenido:t.titulo_obtenido,
          fecha_fin:      t.fecha_fin      ?? null,
          numero_cedula:  t.numero_cedula  ?? null,
          titulo_tesis:   t.titulo_tesis   ?? null,
          menciones:      t.menciones      ?? null,
          firmado_por:    t.firmado_por    ?? null,
        })),
      },
    }

    const nodos = blockchain.getNodos()
    await Promise.allSettled(
      nodos.map(nodo =>
        axios.post(`${nodo}/blocks/receive`, { bloque: bloqueParaPropagar }, {
          headers: { 'X-Propagated': 'true' },
          timeout: 3000,
        }).catch(err => console.warn(`[Propagacion Bloque] Fallo nodo ${nodo}: ${err.message}`))
      )
    )
  }

  res.json({ mensaje: 'Bloque recibido y agregado' })
})

module.exports = router