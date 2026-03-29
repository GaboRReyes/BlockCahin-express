const express = require('express')
const axios   = require('axios')
const router  = express.Router()

// POST /receive
router.post('/receive', async (req, res) => {
  const blockchain = req.app.get('blockchain')
  const bloque = req.body.bloque
  const propagado = req.headers['x-propagated'] === 'true'

  if (!bloque) {
    return res.status(400).json({ error: 'Bloque inválido' })
  }

  // Compatibilidad camelCase <-> snake_case
  const hash_actual = bloque.hash_actual || bloque.hash_actual
  const hash_anterior = bloque.hash_anterior || bloque.hash_anterior
  const firmado_por = bloque.firmado_por || bloque.firmado_por

  if (!hash_actual) {
    return res.status(400).json({ error: 'Bloque inválido: falta hashActual' })
  }

  // Verificar encadenamiento
  const ultimo = blockchain.ultimoBloque
  if (hash_anterior !== ultimo.hash_actual) {
    return res.status(409).json({ error: 'Conflicto de cadena' })
  }

  // Normalizar bloque antes de agregarlo a la cadena
  const bloqueNormalizado = {
    ...bloque,
    hashActual,
    hashAnterior,
    firmadoPor
  }

  blockchain.chain.push(bloqueNormalizado)
  blockchain.transaccionesPendientes = blockchain.transaccionesPendientes.filter(
    tx => !bloqueNormalizado.data?.transacciones?.some(btx => btx.id === tx.id)
  )

  const { persistirBloque } = require('../db/grados')
  try { 
    await persistirBloque(bloqueNormalizado, process.env.NODE_ID || 'nodo-1') 
  } catch (err) { 
    console.error(err) 
  }

  // Propagar a otros nodos
  if (!propagado) {
    const nodos = blockchain.getNodos()
    const propagaciones = nodos.map(nodo =>
      axios.post(`${nodo}/blocks/receive`, { bloque: bloqueNormalizado }, { headers: { 'X-Propagated': 'true' } })
        .catch(err => console.warn(`[Propagacion Bloque] Fallo nodo ${nodo}: ${err.message}`))
    )
    await Promise.allSettled(propagaciones)
  }

  res.json({ mensaje: 'Bloque recibido y agregado' })
})

module.exports = router