import express from 'express';
import { getClient, getClientsByFilters, updateClientById, addClient,deleteClient } from '../tableModels/clientModel.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try 
    {
        const clients = await getClientsByFilters(req.query);
        res.json(clients);
    } 
    catch (err) {
        res.status(500).send(err);
    }
});

router.get('/search', async (req, res) => {
    try 
    {
        const clients = await getClientsByFilters(req.query);
        res.json(clients);
    } 
    catch (err) {
        res.status(500).send(err);
    }
})

router.get('/:id', async (req, res) => {
    const client = await getClient(req.params.id);
    if (client) {
        res.json(client);
    } else {
        res.status(404).send('Клиент не найден');
    }
});

router.post('/', async(req,res) =>{
    try
    {
        const client = await addClient(req.body);
        res.json(client);
    }
    catch(err)
    {
        res.status(500).send(err);
    }
})

router.delete('/:id', async(req,res)=>{
    try
    {
        const client = await deleteClient(req.params.id);
        res.json(client);
    }
    catch(err)
    {
        res.status(500).send("Клиент не найден");
    }
})

router.patch('/:id', async (req, res)=>{
    if(req.params.id)
    {
        try
        {
            const client = await updateClientById(req.params.id, req.body);
            res.json(client);   
        }
        catch
        {
            res.status(500).send('Ошибка обновления');
        }
    }
    else
    {
        res.status(404).send('Клиент не найден');
    }
})

export default router;