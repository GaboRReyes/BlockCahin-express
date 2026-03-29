const { v4: uuidv4 } = require('uuid')

class Transaction {
  /**
   * Representa un grado académico pendiente de minar
   *
   * @param {string} personaId       - UUID de la persona
   * @param {string} institucionId   - UUID de la institución
   * @param {string} programaId      - UUID del programa
   * @param {string} tituloObtenido  - Nombre del título
   * @param {string} fechaFin        - Fecha de graduación (YYYY-MM-DD)
   * @param {string} numeroCedula    - Número de cédula profesional
   * @param {string} firmadoPor      - Nodo que firma la transacción
   */
  constructor({
    persona_id,
    institucion_id,
    programa_id,
    titulo_obtenido,
    fecha_fin,
    numero_cedula = null,
    titulo_tesis  = null,
    menciones    = null,
    firmado_por,
  }) {
    this.id            = uuidv4()
    this.persona_id     = persona_id
    this.institucion_id = institucion_id
    this.programa_id    = programa_id
    this.titulo_obtenido = titulo_obtenido
    this.fecha_fin      = fecha_fin
    this.numero_cedula  = numero_cedula
    this.titulo_tesis   = titulo_tesis
    this.menciones     = menciones
    this.firmado_por    = firmado_por
    this.creado_en      = new Date().toISOString()
  }
}

module.exports = Transaction
