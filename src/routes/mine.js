const express = require('express')
const axios = require('axios')
const router = express.Router()

router.post('/', async (req, res) => {
  const blockchain = req.app.get('blockchain')
  try {
    const bloqueMinado = await blockchain.minar(process.env.NODE_ID || 'nodo-1')

    // Formatear bloque para compatibilidad con nodos externos
    const transacciones = bloqueMinado.data.transacciones
    const bloqueParaPropagar = transacciones.map(tx => ({
      id: tx.id,
      persona_id: tx.persona_id,
      institucion_id: tx.institucion_id,
      programa_id: tx.programa_id,
      fecha_inicio: tx.fecha_inicio || null,
      fecha_fin: tx.fecha_fin || null,
      titulo_obtenido: tx.titulo_obtenido,
      numero_cedula: tx.numero_cedula || null,
      titulo_tesis: tx.titulo_tesis || null,
      menciones: tx.menciones || null,
      hash_actual: bloqueMinado.hash_actual,
      hash_anterior: bloqueMinado.hash_anterior,
      nonce: bloqueMinado.nonce,
      firmado_por: tx.firmado_por || bloqueMinado.data.minado_por,
      creado_en: tx.creado_en || new Date().toISOString(),
    }))

    // Propagar cada transacción como bloque independiente (formato externo)
    const nodos = blockchain.getNodos()
    console.log('[Propagacion] JSON que se enviará a nodos externos:')
    console.log(JSON.stringify(bloqueParaPropagar, null, 2))

    const propagaciones = nodos.flatMap(nodo =>
      bloqueParaPropagar.map(bloqueTx =>
        axios.post(`${nodo}/blocks/receive`, { bloque: bloqueTx }, {
          headers: { 'X-Propagated': 'true' }
        }).catch(err => console.warn(`[Propagacion Bloque] Fallo nodo ${nodo}: ${err.message}`))
      )
    )
    await Promise.allSettled(propagaciones)

    res.json({ mensaje: 'Bloque minado', bloque: bloqueMinado })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

module.exports = router