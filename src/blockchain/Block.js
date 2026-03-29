const { sha256 } = require('../utils/hash')

class Block {
  /**
   * @param {number} index - Posición del bloque en la cadena
   * @param {number} timestamp - Unix timestamp de creación
   * @param {Object} data - Datos académicos (grado)
   * @param {string} hash_anterior - Hash del bloque previo
   * @param {number} nonce - Número encontrado por Proof of Work
   */
  constructor(index, timestamp, data, hash_anterior = '', nonce = 0) {
    this.index = index
    this.timestamp = timestamp
    this.data = data
    this.hash_anterior = hash_anterior
    this.nonce = nonce
    this.hash_actual = this.calcularHash()
  }

  /**
   * Calcula el SHA256 del bloque completo
   * Incluye todos los campos relevantes para que cualquier alteración cambie completamente el hash
   */
  calcularHash() {
    return sha256({
      index: this.index,
      timestamp: this.timestamp,
      data: this.data,
      hash_anterior: this.hash_anterior,
      nonce: this.nonce,
    })
  }

  /**
   * Verificar dificultad deñ¿l hash
   * @param {number} difficulty - Cantidad de ceros iniciales requeridos
   * @returns {boolean}
   */
  cumpleDificultad(difficulty) {
    return this.hash_actual.startsWith('0'.repeat(difficulty))
  }

  toJSON() {
    return {
      index: this.index,
      timestamp: this.timestamp,
      data: this.data,
      hash_anterior: this.hash_anterior,
      nonce: this.nonce,
      hash_actual: this.hash_actual
    }
  } 

}
module.exports = Block

