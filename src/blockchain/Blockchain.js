const Block = require('./Block')
const Transaction = require('./Transaction')

const DIFFICULTY = parseInt(process.env.PROOF_OF_WORK_DIFFICULTY || '3')

class Blockchain {
  constructor() {
    this.chain = []
    this.transaccionesPendientes = []
    this.nodos = new Set()
  }

  formatearFecha(fecha) {
    if (!fecha) return null
    if (/^\d{4}$/.test(fecha)) return `${fecha}-01-01`
    if (/^\d{4}-\d{2}$/.test(fecha)) return `${fecha}-01`
    return fecha.toString().substring(0, 10)  // normaliza ISO completo → "YYYY-MM-DD"
  }

  async inicializar() {
    const { cargarCadena, cargarPeers } = require('../db/grados')

    const [bloquesPersistidos, peersPersistidos] = await Promise.all([
      cargarCadena(),
      cargarPeers(process.env.NODE_ID || 'nodo-1'),
    ])

    if (bloquesPersistidos.length > 0) {
      this.chain = bloquesPersistidos
      console.log(`[Blockchain] Cadena restaurada desde Supabase: ${this.chain.length} bloque(s)`)
    }

    const idsMinados = new Set(
      this.chain.flatMap(b => b.data?.transacciones?.map(tx => tx.id) ?? [])
    )
    this.transaccionesPendientes = this.transaccionesPendientes.filter(
      tx => !idsMinados.has(tx.id)
    )

    peersPersistidos.forEach(dir => this.nodos.add(dir))
    if (peersPersistidos.length > 0) {
      console.log(`[Blockchain] ${peersPersistidos.length} peer(s) restaurados desde Supabase`)
    }
  }

  get ultimoBloque() {
    return this.chain[this.chain.length - 1]
  }

  proofOfWork(data) {
    const index = this.chain.length
    const timestamp = Date.now()
    const hash_anterior = this.ultimoBloque.hash_actual
    let nonce = 0

    console.log(`[PoW] Minando bloque #${index} con dificultad ${DIFFICULTY}...`)

    let bloque = new Block(index, timestamp, data, hash_anterior, nonce)
    while (!bloque.cumpleDificultad(DIFFICULTY)) {
      nonce++
      bloque = new Block(index, timestamp, data, hash_anterior, nonce)
    }

    console.log(`[PoW] Bloque #${index} minado! nonce=${nonce} hash=${bloque.hash_actual}`)
    return bloque
  }

  limpiarDuplicados() {
    const ids = new Set()
    this.transaccionesPendientes = this.transaccionesPendientes.filter(tx => {
      if (ids.has(tx.id)) return false
      ids.add(tx.id)
      return true
    })
  }

  async minar(nodeId) {
    this.limpiarDuplicados()
    if (this.transaccionesPendientes.length === 0) {
      throw new Error('No hay transacciones pendientes para minar')
    }

    const data = {
      transacciones: this.transaccionesPendientes.map(tx => ({
        id:              tx.id,
        persona_id:      tx.persona_id,
        institucion_id:  tx.institucion_id,
        programa_id:     tx.programa_id,
        titulo_obtenido: tx.titulo_obtenido,
        fecha_inicio:    tx.fecha_inicio    || null,
        fecha_fin:       this.formatearFecha(tx.fecha_fin),
        numero_cedula:   tx.numero_cedula   || null,
        titulo_tesis:    tx.titulo_tesis    || null,
        menciones:       tx.menciones       || null,
        firmado_por:     tx.firmado_por     || null,
      })),
      minado_por: 'Gabo-Nodo 2',
    }

    const bloque = this.proofOfWork(data)
    this.chain.push(bloque)
    this.transaccionesPendientes = []

    const { persistirBloque } = require('../db/grados')
    try {
      await persistirBloque(bloque, nodeId)
    } catch (err) {
      console.error('[Blockchain] Error de persistencia:', err.message)
    }

    const bloqueParaPropagar = {
      index:         bloque.index,
      timestamp:     bloque.timestamp,
      hash_actual:   bloque.hash_actual,
      hash_anterior: bloque.hash_anterior,
      nonce:         bloque.nonce,
      firmado_por:   'Gabo-Nodo 2',
      data: {
        minadoPor: 'Gabo-Nodo 2',
        transacciones: bloque.data.transacciones.map(t => ({
          persona_id:      t.persona_id,
          institucion_id:  t.institucion_id,
          programa_id:     t.programa_id     ?? null,
          titulo_obtenido: t.titulo_obtenido,
          fecha_fin:       t.fecha_fin       ?? null,
          numero_cedula:   t.numero_cedula   ?? null,
          titulo_tesis:    t.titulo_tesis    ?? null,
          menciones:       t.menciones       ?? null,
          firmado_por:     t.firmado_por     ?? null,
        })),
      },
    }

    return { bloque: bloque.toJSON(), bloqueParaPropagar }
  }

  agregarTransaccion(datosGrado) {
    const tx = new Transaction(datosGrado)

    // Respetar el id externo si viene (UUID de propagación)
    if (datosGrado.id) {
      tx.id = datosGrado.id
    }

    const yaMinada = this.chain.some(b =>
      b.data?.transacciones?.some(t => t.id === tx.id)
    )
    if (yaMinada) {
      console.warn(`[Transaccion] Ignorada — ya está minada: ${tx.id}`)
      return null
    }

    const yaEnMempool = this.transaccionesPendientes.some(t => t.id === tx.id)
    if (yaEnMempool) {
      console.warn(`[Transaccion] Ignorada — ya está en mempool: ${tx.id}`)
      return null
    }

    this.transaccionesPendientes.push(tx)
    console.log(`[Transaccion] Nueva transacción agregada: ${tx.id}`)
    return tx
  }

  esValida(chain = this.chain) {
  for (let i = 1; i < chain.length; i++) {
    const actual = chain[i]
    const anterior = chain[i - 1]

    if (actual.hash_anterior !== anterior.hash_actual) {
      console.warn(`[Validacion] Encadenamiento roto en bloque #${i}`)
      return false
    }

    if (!actual.hash_actual.startsWith('0'.repeat(DIFFICULTY))) {
      console.warn(`[Validacion] PoW inválido en bloque #${i}`)
      return false
    }
  }
  return true
}

  reemplazarCadena(cadenaExterna) {
  // Normalizar formato aplanado → interno antes de validar
  const cadenaNormalizada = cadenaExterna.map((bloque, i) => {
    if (i === 0 || bloque.data?.transacciones) return bloque

    if (bloque.persona_id) {
      return {
        index:         bloque.index ?? bloque.indice ?? i,
        timestamp:     bloque.timestamp ?? 0,
        hash_actual:   bloque.hash_actual,
        hash_anterior: bloque.hash_anterior,
        nonce:         bloque.nonce ?? 0,
        data: {
          transacciones: [{
            id:              bloque.id              ?? null,
            persona_id:      bloque.persona_id,
            institucion_id:  bloque.institucion_id,
            programa_id:     bloque.programa_id     ?? null,
            titulo_obtenido: bloque.titulo_obtenido,
            fecha_inicio:    bloque.fecha_inicio    ?? null,
            fecha_fin:       bloque.fecha_fin ? bloque.fecha_fin.toString().substring(0, 10) : null,
            numero_cedula:   bloque.numero_cedula   ?? null,
            titulo_tesis:    bloque.titulo_tesis    ?? null,
            menciones:       bloque.menciones       ?? null,
            firmado_por:     bloque.firmado_por     ?? null,
          }],
          minado_por: bloque.firmado_por || 'externo',
        }
      }
    }

    return bloque
  })

  if (cadenaNormalizada.length > this.chain.length && this.esValida(cadenaNormalizada)) {
    console.log(`[Consenso] Cadena reemplazada: ${this.chain.length} → ${cadenaNormalizada.length} bloques`)
    this.chain = cadenaNormalizada

    const idsMinados = new Set(
      this.chain.flatMap(b => b.data?.transacciones?.map(tx => tx.id) ?? [])
    )
    this.transaccionesPendientes = this.transaccionesPendientes.filter(
      tx => !idsMinados.has(tx.id)
    )

    return true
  }
  return false
}

  resetearCadena() {
    this.chain = []
    this.transaccionesPendientes = []
    this.transaccionesVistas = new Set()
    console.log('[Blockchain] Cadena reiniciada')
  }

  registrarNodo(direccion) {
    const dir = direccion.replace(/\/$/, '')
    this.nodos.add(dir)
    console.log(`[Red] Nodo registrado: ${dir}. Total nodos: ${this.nodos.size}`)

    const { guardarPeer } = require('../db/grados')
    guardarPeer(process.env.NODE_ID || 'nodo-1', dir)
      .catch(err => console.error('[Blockchain] Error guardando peer:', err.message))
  }

  getNodos() {
    return Array.from(this.nodos)
  }
}

module.exports = Blockchain