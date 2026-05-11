import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getClient, getClientsByFilters, updateClientById, addClient } from '../tableModels/clients.service.js';

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
    const result = await getClientsByFilters(req.query);
    res.json(result);
}));

router.get('/search', asyncHandler(async (req, res) => {
    const result = await getClientsByFilters(req.query);
    res.json(result);
}))

router.get('/:id', asyncHandler(async (req, res) => {
    const result = await getClient(req.params.id);
    res.json(result);
}));

router.post('/', asyncHandler( async(req,res) =>{
    const result = await addClient(req.body);
    res.json(result);
}));

router.patch('/:id', asyncHandler(async (req, res)=>{
    const result = await updateClientById(req.params.id, req.body);
    res.json(result);   
}));

export default router;