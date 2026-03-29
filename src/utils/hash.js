const crypto = require('crypto')

/**
 * Genera un hash SHA256
 * Acepta string (concatenación plana) o cualquier otro tipo (se convierte a JSON)
 */
function sha256(data) {
  const contenido = typeof data === 'string' ? data : JSON.stringify(data)
  return crypto
    .createHash('sha256')
    .update(contenido)
    .digest('hex')
}

module.exports = { sha256 }