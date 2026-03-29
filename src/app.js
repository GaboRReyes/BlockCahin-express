require('dotenv').config()

// Módulos principales
const express = require('express')
const Blockchain = require('./blockchain/Blockchain')
const logger = require('./middleware/logger')

//Rutas
const chainRoutes = require('./routes/chain')
const mineRoutes = require('./routes/mine')
const transactionRoutes = require('./routes/transactions')
const nodeRoutes = require('./routes/nodes')
const blockRoutes = require('./routes/blocks')

const swaggerUi = require('swagger-ui-express')
const YAML = require('yamljs')
const swaggerDoc = YAML.load('./swagger.yaml')
const cors = require('cors')

//Inicialización del servidor
async function startServer() {
  const app = express()
  const PORT = process.env.PORT || 8002

  // Inicializar la red
  const blockchain = new Blockchain()
  await blockchain.inicializar()
  app.set('blockchain', blockchain)

  app.use(express.json())
  app.use(cors())
  app.use(logger)

  // Rutas de la API
  app.use('/chain', chainRoutes)
  app.use('/mine', mineRoutes)
  app.use('/transactions', transactionRoutes)
  app.use('/nodes', nodeRoutes)
  app.use('/blocks', blockRoutes)
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc))

  // Ruta de salud para monitoreo
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      nodeId: process.env.NODE_ID || 'nodo-1',
      port: PORT,
      bloques: blockchain.chain.length,
      pendientes: blockchain.transaccionesPendientes.length,
      peers: blockchain.getNodos(),
    })
  })

  app.use((req, res) => {
    res.status(404).json({ error: `Ruta ${req.method} ${req.path} no encontrada` })
  })

  app.use((err, req, res, next) => {
    console.error(`[Error] ${err.message}`)
    res.status(500).json({ error: 'Error interno del servidor' })
  })

  app.listen(PORT, () => {
    console.log(`\n Nodo blockchain corriendo`)
    console.log(`   NODE_ID : ${process.env.NODE_ID || 'nodo-1'}`)
    console.log(`   Puerto  : ${PORT}`)
    console.log(`   PoW     : ${'0'.repeat(parseInt(process.env.PROOF_OF_WORK_DIFFICULTY || '3'))}...\n`)
  })
}

startServer().catch(err => {
  console.error('[Fatal] No se pudo iniciar el servidor:', err.message)
  process.exit(1)
})
