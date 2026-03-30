  const { v4: uuidv4 } = require('uuid')
  const crypto = require('crypto')

  class Transaction {
    constructor({
      persona_id,
      institucion_id,
      programa_id,
      titulo_obtenido,
      fecha_fin,
      numero_cedula = null,
      titulo_tesis  = null,
      menciones     = null,
      firmado_por,
    }) {

      // UUID interno (no sirve para validar duplicados)
      this.uuid = uuidv4()

      this.persona_id      = persona_id
      this.institucion_id  = institucion_id
      this.programa_id     = programa_id
      this.titulo_obtenido = titulo_obtenido
      this.fecha_fin       = fecha_fin
      this.numero_cedula   = numero_cedula
      this.titulo_tesis    = titulo_tesis
      this.menciones       = menciones
      this.firmado_por     = firmado_por
      this.creado_en       = new Date().toISOString()

      
      this.id = this.calcularHash()
    }

    calcularHash() {
      return crypto
        .createHash('sha256')
        .update(
          this.persona_id +
          this.institucion_id +
          this.programa_id +
          this.titulo_obtenido +
          this.fecha_fin +
          (this.numero_cedula || '') +
          (this.titulo_tesis || '') +
          (this.menciones || '')
        )
        .digest('hex')
    }
  }

  module.exports = Transaction