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

    // Año solamente
    if (/^\d{4}$/.test(fecha)) {
      return `${fecha}-01-01`
    }

    // Año-mes
    if (/^\d{4}-\d{2}$/.test(fecha)) {
      return `${fecha}-01`
    }

    return fecha
  }

  /**
     * Inicializa la cadena cargando desde Supabase.
     * Si no hay bloques persistidos, crea el génesis.
     * Se debe llamar con await antes de arrancar el servidor.
     */
  async inicializar() {
    const { cargarCadena, cargarPeers } = require('../db/grados')

    const [bloquesPersistidos, peersPersistidos] = await Promise.all([
      cargarCadena(),
      cargarPeers(process.env.NODE_ID || 'nodo-1'),
    ])

    if (bloquesPersistidos.length > 0) {
      this.chain = bloquesPersistidos
      console.log(`[Blockchain] Cadena restaurada desde Supabase: ${this.chain.length} bloque(s)`)
    } else {
      this._crearBloqueGenesis()
    }

    peersPersistidos.forEach(dir => this.nodos.add(dir))
    if (peersPersistidos.length > 0) {
      console.log(`[Blockchain] ${peersPersistidos.length} peer(s) restaurados desde Supabase`)
    }
  }

  _crearBloqueGenesis() {
    const genesis = new Block(
      0,
      Date.now(),
      { mensaje: 'Bloque Génesis - Red Blockchain Grados de Académicos' },
      '0',
      0
    )
    this.chain.push(genesis)
    console.log(`[Blockchain] Bloque creado: ${genesis.hash_actual}`)
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



  async minar(nodeId) {
    if (this.transaccionesPendientes.length === 0) {
      throw new Error('No hay transacciones pendientes para minar')
    }

    const data = {
      transacciones: this.transaccionesPendientes.map(tx => ({
        id: tx.id,
        persona_id: tx.persona_id,
        institucion_id: tx.institucion_id,
        programa_id: tx.programa_id,
        titulo_obtenido: tx.titulo_obtenido,
        fecha_inicio: tx.fecha_inicio || null,
        fecha_fin: this.formatearFecha(tx.fecha_fin),
        numero_cedula: tx.numero_cedula || null,
        titulo_tesis: tx.titulo_tesis || null,
        menciones: tx.menciones || null,
        firmado_por: tx.firmado_por || null,
        creado_en: tx.creado_en || null,
      })),
      minado_por: nodeId,
    }

    const bloque = this.proofOfWork(data)

    console.log("Tipo de bloque:", bloque.constructor.name)
    console.log('[DEBUG BLOQUE]', JSON.stringify(bloque, null, 2))

    this.chain.push(bloque)
    this.transaccionesPendientes = []

    const { persistirBloque } = require('../db/grados')

    try {
      await persistirBloque(bloque, nodeId)
    } catch (err) {
      console.error('[Blockchain] Error de persistencia:', err.message)
    }


    return bloque.toJSON()
  }


  agregarTransaccion(datosGrado) {
    const tx = new Transaction(datosGrado)
    this.transaccionesPendientes.push(tx)
    console.log(`[Transaccion] Nueva transacción agregada: ${tx.id}`)
    return tx
  }


  esValida(chain = this.chain) {
    for (let i = 1; i < chain.length; i++) {
      const actual = chain[i]
      const anterior = chain[i - 1]

      const bloqueRecalculado = new Block(
        actual.index,
        actual.timestamp,
        actual.data,
        actual.hash_anterior,
        actual.nonce
      )
      if (actual.hash_actual !== bloqueRecalculado.hash_actual) {
        console.warn(`[Validacion] Hash inválido en bloque #${i}`)
        return false
      }
      if (actual.hash_anterior !== anterior.hash_actual) {
        console.warn(`[Validacion] Encadenamiento roto en bloque #${i}`)
        return false
      }
      if (!actual.cumpleDificultad(DIFFICULTY)) {
        console.warn(`[Validacion] PoW inválido en bloque #${i}`)
        return false
      }
    }
    return true
  }


  reemplazarCadena(cadenaExterna) {
    if (cadenaExterna.length > this.chain.length && this.esValida(cadenaExterna)) {
      console.log(`[Consenso] Cadena reemplazada: ${this.chain.length} → ${cadenaExterna.length} bloques`)
      this.chain = cadenaExterna
      return true
    }
    return false
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
