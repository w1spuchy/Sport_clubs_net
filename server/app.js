import express from 'express'
import clientsRoutes from './routes/clientsRouter.js'

const app = express()

app.use(express.json());

app.use('/api/clients', clientsRoutes)

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Error');
})
app.listen(8080, ()=> {
    console.log('Server is running');
})