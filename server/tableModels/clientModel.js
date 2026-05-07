import pool from "../dataBase.js";

export async function getClient(id) {
    const [res] = await pool.query(
        `
            SELECT *
            FROM clients
            WHERE idClient = ?
        `, [id])    
    return res[0];
}

export async function getClientsByFilters(filters) {
    let quary = "SELECT * FROM clients WHERE 1=1";
    const values = [];

    if(filters.name)
    {
        quary += " AND fullName LIKE ?";
        values.push(`%${filters.name}%`);
    }
    if(filters.dateOfBirth)
    {
        quary += " AND DateOfBirth > ?";
        values.push(filters.dateOfBirth);
    }

    const [res] = await pool.query(quary, values);
    return res;
}

export async function updateClientById(id, body) 
{
    let quary = 
    `
        UPDATE clients SET 
    `
    const values = [] 

    const updateParams = [];
    if(body.FullName)
    {
        updateParams.push(`FullName = ?`);
        values.push(body.FullName);
    }
    if(body.DateOfBirth)
    {
        updateParams.push(`DateOfBirth = ?`);
        values.push(body.DateOfBirth);
    }
    if(body.PhoneNum)
    {
        updateParams.push(`PhoneNum = ?`);
        values.push(body.PhoneNum);
    }
    if(body.Email)
    {
        updateParams.push(`Email = ?`);
        values.push(body.Email);
    }

    quary += updateParams.join(', ');
    quary += ` WHERE idClient = ?`;
    values.push(id);

    await pool.query(quary, values);
    return getClient(id);
}

export async function addClient(body) {
    const [res] = await pool.query(`
        INSERT INTO clients (FullName, DateOfBirth, PhoneNum, Email)
        VALUES (?, ?, ?, ?)    
    `, [body.FullName, body.DateOfBirth, body.PhoneNum, body.Email]);
    
    const id = res.insertId;
    return getClient(id);
}

export async function deleteClient(id) 
{
    const client = await getClient(id);
    if(client)
    {
        const res = await pool.query(`
                DELETE FROM clients WHERE idClient = ?
            `, [id]);
        return client;
    }
    else
    {
        const err = new Error('Клиент не найден');
        throw err
    }
}