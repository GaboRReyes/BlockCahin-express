const { sha256 } = require('../utils/hash')

class Block {
  constructor(index, timestamp, data, hash_anterior = '', nonce = 0) {
    this.index = index
    this.timestamp = timestamp
    this.data = data
    this.hash_anterior = hash_anterior
    this.nonce = nonce
    this.hash_actual = this.calcularHash()
  }

  calcularHash() {
    const tx = this.data?.transacciones?.[0] ?? this.data ?? {}

    const fechaCorta = tx.fecha_fin
      ? tx.fecha_fin.toString().substring(0, 10)
      : ''

    const cadena = `${tx.persona_id ?? ''}${tx.institucion_id ?? ''}${tx.titulo_obtenido ?? ''}${fechaCorta}${this.hash_anterior ?? ''}${this.nonce}`


    return sha256(cadena)
  }

  cumpleDificultad(difficulty) {
    return this.hash_actual.startsWith('0'.repeat(difficulty))
  }

  toJSON() {
    return {
      index:         this.index,
      timestamp:     this.timestamp,
      data:          this.data,
      hash_anterior: this.hash_anterior,
      nonce:         this.nonce,
      hash_actual:   this.hash_actual,
    }
  }
}

module.exports = Block