const supabase = require('./supabase')

/**
 * Persistir bloque SIN campos extra
 */
async function persistirBloque(bloque, nodeId) {
  const transacciones = bloque.data?.transacciones || []

  if (transacciones.length === 0) {
    console.warn('[DB] Bloque sin transacciones académicas')
    return
  }

  const registros = transacciones.map((tx) => ({
    id: tx.id,
    persona_id: tx.personaId,
    institucion_id: tx.institucionId,
    programa_id: tx.programaId,
    titulo_obtenido: tx.tituloObtenido,
    fecha_fin: tx.fechaFin,
    numero_cedula: tx.numeroCedula || null,
    titulo_tesis: tx.tituloTesis || null,
    menciones: tx.menciones || null,
    firmado_por: tx.firmadoPor,

    //Blockchain
    hash_actual: bloque.hashActual,
    hash_anterior: bloque.hashAnterior,
    nonce: bloque.nonce,
  }))

  const { error } = await supabase.from('grados').insert(registros)

  if (error) {
    console.error('[DB] Error al persistir bloque:', error.message)
    throw error
  }

  console.log(`[DB] ${registros.length} grado(s) persistidos`)
}



/**
 * Reconstrucción de bloque
 */
async function cargarCadena() {
  const { data, error } = await supabase
    .from('grados')
    .select('*')

  if (error) {
    console.error('[DB] Error al cargar cadena:', error.message)
    return []
  }

  if (!data || data.length === 0) return []

  // Agrupar por hash_actual
  const bloquesMap = {}

  for (const r of data) {
    if (!bloquesMap[r.hash_actual]) {
      bloquesMap[r.hash_actual] = {
        hashActual: r.hash_actual,
        hashAnterior: r.hash_anterior,
        nonce: r.nonce,
        timestamp: Date.now(),
        data: {
          minadoPor: 'desconocido',
          transacciones: [],
        },
      }
    }

    bloquesMap[r.hash_actual].data.transacciones.push({
      id: r.id,
      personaId: r.persona_id,
      institucionId: r.institucion_id,
      programaId: r.programa_id,
      tituloObtenido: r.titulo_obtenido,
      fechaFin: r.fecha_fin,
      numeroCedula: r.numero_cedula,
      tituloTesis: r.titulo_tesis,
      menciones: r.menciones,
      firmadoPor: r.firmado_por,
    })
  }

  const bloques = Object.values(bloquesMap)

  // Encontrar inicio
  let actual = bloques.find(b =>
    !bloques.some(x => x.hashActual === b.hashAnterior)
  )

  const cadena = []

  while (actual) {
    cadena.push(actual)
    actual = bloques.find(b => b.hashAnterior === actual.hashActual)
  }

  // Génesis
  const genesis = {
    index: 0,
    hashActual: cadena[0]?.hashAnterior || '0',
    hashAnterior: '0',
    nonce: 0,
    timestamp: Date.now(),
    data: { mensaje: 'Bloque Génesis' },
  }

  return [genesis, ...cadena.map((b, i) => ({ ...b, index: i + 1 }))]
}

/**
 * Guardar peer (tabla nodos ya existente)
 */
async function guardarPeer(nodeId, direccion) {
  const { error } = await supabase
    .from('nodos')
    .upsert(
      { nodo_origen: nodeId, direccion, activo: true },
      { onConflict: 'nodo_origen,direccion' }
    )

  if (error) console.error('[DB] Error al guardar peer:', error.message)
}

/**
 * Cargar peers
 */
async function cargarPeers(nodeId) {
  const { data, error } = await supabase
    .from('nodos')
    .select('direccion')
    .eq('nodo_origen', nodeId)
    .eq('activo', true)

  if (error) {
    console.error('[DB] Error al cargar peers:', error.message)
    return []
  }

  return data.map(r => r.direccion)
}

module.exports = {
  persistirBloque,
  cargarCadena,
  guardarPeer,
  cargarPeers
}