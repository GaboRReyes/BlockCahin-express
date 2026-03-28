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
    personaId,
    institucionId,
    programaId,
    tituloObtenido,
    fechaFin,
    numeroCedula = null,
    tituloTesis  = null,
    menciones    = null,
    firmadoPor,
  }) {
    this.id            = uuidv4()
    this.personaId     = personaId
    this.institucionId = institucionId
    this.programaId    = programaId
    this.tituloObtenido = tituloObtenido
    this.fechaFin      = fechaFin
    this.numeroCedula  = numeroCedula
    this.tituloTesis   = tituloTesis
    this.menciones     = menciones
    this.firmadoPor    = firmadoPor
    this.creadoEn      = new Date().toISOString()
  }
}

module.exports = Transaction
