const supabase = require('./supabase')

/**
 * Persistir bloque con timestamp incluido
 */
async function persistirBloque(bloque, nodeId) {
  const transacciones = bloque.data?.transacciones || []

  if (transacciones.length === 0) {
    console.warn('[DB] Bloque sin transacciones académicas')
    return
  }

  const registros = transacciones.map((tx) => ({
    // id lo genera Postgres automáticamente (gen_random_uuid())
    persona_id:     tx.persona_id,
    institucion_id: tx.institucion_id,
    programa_id:    tx.programa_id    ?? null,
    titulo_obtenido:tx.titulo_obtenido,
    fecha_fin:      tx.fecha_fin      ?? null,
    numero_cedula:  tx.numero_cedula  ?? null,
    titulo_tesis:   tx.titulo_tesis   ?? null,
    menciones:      tx.menciones      ?? null,
    firmado_por:    tx.firmado_por    ?? null,

    // Blockchain
    hash_actual:    bloque.hash_actual,
    hash_anterior:  bloque.hash_anterior,
    nonce:          bloque.nonce,
  }))

  const { error } = await supabase
    .from('grados')
    .upsert(registros, { onConflict: 'id', ignoreDuplicates: true }) // ← evita duplicados si el bloque llega dos veces

  if (error) {
    console.error('[DB] Error al persistir bloque:', error.message)
    throw error
  }

  console.log(`[DB] ${registros.length} grado(s) persistidos`)
}


/**
 * Reconstrucción de bloque desde Supabase
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
        hash_actual:   r.hash_actual,
        hash_anterior: r.hash_anterior,
        nonce:         r.nonce,
        timestamp:     0,
        data: {
          minado_por:    r.firmado_por ?? 'desconocido',
          transacciones: [],
        },
      }
    }

    bloquesMap[r.hash_actual].data.transacciones.push({
      id:             r.id,
      persona_id:     r.persona_id,
      institucion_id: r.institucion_id,
      programa_id:    r.programa_id,
      titulo_obtenido:r.titulo_obtenido,
      fecha_fin:      r.fecha_fin,
      numero_cedula:  r.numero_cedula,
      titulo_tesis:   r.titulo_tesis,
      menciones:      r.menciones,
      firmado_por:    r.firmado_por,
    })
  }

  const bloques = Object.values(bloquesMap)

  // Encontrar el bloque raíz (el que ningún otro apunta como siguiente)
  let actual = bloques.find(b =>
    !bloques.some(x => x.hash_actual === b.hash_anterior)
  )

  const cadena = []

  while (actual) {
    cadena.push(actual)
    actual = bloques.find(b => b.hash_anterior === actual.hash_actual)
  }

  // Génesis sintético reconstruido a partir del primer bloque real
  const genesis = {
    index:         0,
    hash_actual:   cadena[0]?.hash_anterior || '0',
    hash_anterior: '0',
    nonce:         0,
    timestamp:     0,
    data:          { mensaje: 'Bloque Génesis' },
  }

  return [genesis, ...cadena.map((b, i) => ({ ...b, index: i + 1 }))]
}

/**
 * Guardar peer en tabla nodos
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
 * Cargar peers activos del nodo
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