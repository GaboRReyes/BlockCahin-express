const crypto = require('crypto')

/**
 * Genera un hash SHA256 a partir de cualquier dato
 * @param {any} data - Dato a hashear (se convierte a JSON string)
 * @returns {string} Hash hexadecimal
 */
function sha256(data) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex')
}

module.exports = { sha256 }
