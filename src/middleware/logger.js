const morgan = require('morgan')

// Formato custom: método, URL, status, tiempo, IP origen
const formato = ':method :url :status :response-time ms - :remote-addr'

const logger = morgan(formato, {
  // Colorear según status en consola
  stream: {
    write: (message) => {
      const status = parseInt(message.split(' ')[2])
      if (status >= 500)      process.stdout.write(`\x1b[31m${message}\x1b[0m`) // rojo
      else if (status >= 400) process.stdout.write(`\x1b[33m${message}\x1b[0m`) // amarillo
      else                    process.stdout.write(`\x1b[32m${message}\x1b[0m`) // verde
    }
  }
})

module.exports = logger
