const express = require('express')
const axios   = require('axios')
const router  = express.Router()

function normalizarBloqueExterno(bloque) {
  if (bloque.data?.transacciones) {
    bloque.data.transacciones = bloque.data.transacciones.map(tx => ({
      ...tx,
      id: tx.id ?? null,
      fecha_fin: tx.fecha_fin ? tx.fecha_fin.toString().substring(0, 10) : null,
    }))
    if (!bloque.data.minado_por && bloque.data.minadoPor) {
      bloque.data.minado_por = bloque.data.minadoPor
    }
    return bloque
  }

  const tx = {
    id:              bloque.id             ?? null,
    persona_id:      bloque.persona_id,
    institucion_id:  bloque.institucion_id,
    programa_id:     bloque.programa_id    ?? null,
    titulo_obtenido: bloque.titulo_obtenido,
    fecha_inicio:    bloque.fecha_inicio   ?? null,
    fecha_fin:       bloque.fecha_fin ? bloque.fecha_fin.toString().substring(0, 10) : null,
    numero_cedula:   bloque.numero_cedula  ?? null,
    titulo_tesis:    bloque.titulo_tesis   ?? null,
    menciones:       bloque.menciones      ?? null,
    firmado_por:     bloque.firmado_por    ?? null,
    creado_en:       bloque.creado_en      ?? new Date().toISOString(),
  }

  return {
    index:         bloque.index ?? bloque.indice ?? null,
    timestamp:     bloque.timestamp ?? Date.now(),
    hash_actual:   bloque.hash_actual,
    hash_anterior: bloque.hash_anterior,
    nonce:         bloque.nonce ?? 0,
    data: {
      transacciones: [tx],
      minado_por:    bloque.firmado_por || 'externo',
    }
  }
}

router.post('/receive', async (req, res) => {
  const blockchain = req.app.get('blockchain')
  const propagado  = req.headers['x-propagated'] === 'true'

  const bloqueRaw = req.body.bloque ?? req.body

  console.log('[Receive] Body recibido:', JSON.stringify(req.body, null, 2))

  if (!bloqueRaw || !bloqueRaw.hash_actual) {
    return res.status(400).json({ error: 'Bloque inválido: falta hash_actual' })
  }

  const bloque = normalizarBloqueExterno(bloqueRaw)

  // Deduplicar
  const yaExiste = blockchain.chain.some(b => b.hash_actual === bloque.hash_actual)
  if (yaExiste) {
    return res.status(200).json({ mensaje: 'Bloque ya existe en la cadena (duplicado ignorado)' })
  }


  if (!blockchain.ultimoBloque) {
    return res.status(503).json({ error: 'Blockchain no inicializado aún' })
  }

  // Conflicto de cadena — disparar consenso automático en background
  if (bloque.hash_anterior !== blockchain.ultimoBloque.hash_actual) {
    console.warn(`[Receive] Conflicto de cadena — esperado: ${blockchain.ultimoBloque.hash_actual} | recibido: ${bloque.hash_anterior}`)

    setImmediate(async () => {
      const nodos = blockchain.getNodos()
      for (const nodo of nodos) {
        try {
          const { data } = await axios.get(`${nodo}/chain`, { timeout: 5000 })
          const cadena = data.cadena ?? data.chain ?? (Array.isArray(data) ? data : null)
          if (cadena && blockchain.reemplazarCadena(cadena)) {
            console.log(`[Consenso Auto] Cadena adoptada desde ${nodo}`)
            break
          }
        } catch (err) {
          console.warn(`[Consenso Auto] Fallo nodo ${nodo}: ${err.message}`)
        }
      }
    })

    return res.status(409).json({ error: 'Conflicto de cadena — sincronización iniciada' })
  }

  blockchain.chain.push(bloque)

  // Limpiar mempool
  blockchain.transaccionesPendientes = blockchain.transaccionesPendientes.filter(
    tx => !bloque.data.transacciones.some(btx => btx.id && btx.id === tx.id)
  )

  const { persistirBloque } = require('../db/grados')
  try {
    await persistirBloque(bloque, process.env.NODE_ID || 'nodo-1')
  } catch (err) {
    console.error('[Receive] Error persistiendo:', err.message)
  }

  // Re-propagar si no viene de un peer
  if (!propagado) {
    const tx = bloque.data.transacciones[0] ?? {}
    const bloqueParaPropagar = {
      index:           bloque.index,
      timestamp:       bloque.timestamp,
      hash_actual:     bloque.hash_actual,
      hash_anterior:   bloque.hash_anterior,
      nonce:           bloque.nonce,
      firmado_por:     bloque.data.minado_por || 'externo',
      id:              tx.id              ?? null,
      persona_id:      tx.persona_id      ?? null,
      institucion_id:  tx.institucion_id  ?? null,
      programa_id:     tx.programa_id     ?? null,
      titulo_obtenido: tx.titulo_obtenido ?? null,
      fecha_inicio:    tx.fecha_inicio    ?? null,
      fecha_fin:       tx.fecha_fin       ?? null,
      numero_cedula:   tx.numero_cedula   ?? null,
      titulo_tesis:    tx.titulo_tesis    ?? null,
      menciones:       tx.menciones       ?? null,
      firmado_por:     tx.firmado_por     ?? null,
      creado_en:       tx.creado_en       ?? null,
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

router.delete('/rollback', (req, res) => {
  const blockchain = req.app.get('blockchain')

  if (blockchain.chain.length <= 1) {
    return res.status(400).json({ error: 'No se puede hacer rollback: solo queda el génesis' })
  }

  const eliminado = blockchain.chain.pop()
  console.warn(`[Rollback] Bloque eliminado: index=${eliminado.index} hash=${eliminado.hash_actual}`)

  res.json({
    mensaje:   'Último bloque eliminado de la cadena',
    eliminado: {
      index:         eliminado.index,
      hash_actual:   eliminado.hash_actual,
      hash_anterior: eliminado.hash_anterior,
    },
    nuevoUltimo: {
      index:       blockchain.ultimoBloque.index,
      hash_actual: blockchain.ultimoBloque.hash_actual,
    }
  })
})

module.exports = router