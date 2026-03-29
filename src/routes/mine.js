const express = require('express')
const axios = require('axios')
const router = express.Router()

router.post('/', async (req, res) => {
  const blockchain = req.app.get('blockchain')
  try {
    const bloque = await blockchain.minar(process.env.NODE_ID || 'nodo-1')

    // Formatear bloque para compatibilidad con nodos externos
    const transacciones = bloque.data.transacciones
    const nodos = blockchain.getNodos()

    // Tomamos la primera transacción del bloque
    const tx = bloque.data.transacciones[0]

    const bloqueParaPropagar = {
      bloque: {
        persona_id: tx.persona_id,
        institucion_id: tx.institucion_id,
        programa_id: tx.programa_id,
        fecha_inicio: tx.fecha_inicio,
        fecha_fin: tx.fecha_fin,
        titulo_obtenido: tx.titulo_obtenido,
        numero_cedula: tx.numero_cedula,
        titulo_tesis: tx.titulo_tesis,
        menciones: tx.menciones,
        hash_actual: bloque.hash_actual,
        hash_anterior: bloque.hash_anterior,
        nonce: bloque.nonce,
        firmado_por: bloque.data.firmado_por
      }
    }

    console.log('[Propagacion] JSON que se enviará:', JSON.stringify(bloqueParaPropagar, null, 2))

    const propagaciones = nodos.map(nodo =>
      axios.post(`${nodo}/blocks/receive`, bloqueParaPropagar, {
        headers: { 'X-Propagated': 'true' }
      }).catch(err =>
        console.warn(`[Propagacion Bloque] Fallo nodo ${nodo}: ${err.message}`)
      )
    )

    await Promise.allSettled(propagaciones)

    res.json({ mensaje: 'Bloque minado', bloque: bloqueMinado })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

module.exports = router