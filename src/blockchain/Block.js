const { sha256 } = require('../utils/hash')

class Block {
  /**
   * @param {number} index - Posición del bloque en la cadena
   * @param {number} timestamp - Unix timestamp de creación
   * @param {Object} data - Datos académicos (grado)
   * @param {string} hashAnterior - Hash del bloque previo
   * @param {number} nonce - Número encontrado por Proof of Work
   */
  constructor(index, timestamp, data, hashAnterior = '', nonce = 0) {
    this.index = index
    this.timestamp = timestamp
    this.data = data
    this.hashAnterior = hashAnterior
    this.nonce = nonce
    this.hashActual = this.calcularHash()
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
      hashAnterior: this.hashAnterior,
      nonce: this.nonce,
    })
  }

  /**
   * Verificar dificultad deñ¿l hash
   * @param {number} difficulty - Cantidad de ceros iniciales requeridos
   * @returns {boolean}
   */
  cumpleDificultad(difficulty) {
    return this.hashActual.startsWith('0'.repeat(difficulty))
  }

  toJSON() {
    return {
      index: this.index,
      timestamp: this.timestamp,
      data: this.data,
      hashAnterior: this.hashAnterior,
      nonce: this.nonce,
      hashActual: this.hashActual
    }
  } 

}
module.exports = Block

