import pool from "../dataBase.js";
import { HttpError } from "../utils/HttpError.js";

const EMAIL_REGEX= /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PHONE_REGEX = /^[0-9+() \-]{10,18}$/;

function isValidDate(d) {
  if (typeof d !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const date = new Date(d + "T00:00:00Z");
  return !Number.isNaN(date.getTime());
}

export async function getClient(id) {
    const idNum = Number(id);
    if (!Number.isInteger(idNum) || idNum <= 0) throw new HttpError(400, "Invalid idClient");
    const [res] = await pool.query(
        `
            SELECT *
            FROM clients
            WHERE idClient = ?
        `, [idNum])    
    return res[0] ?? null;
}

export async function getClientsByFilters(filters) {
    let quary = "SELECT * FROM clients WHERE 1=1";
    const values = [];

    if(filters.name)
    {
        quary += ` AND fullName LIKE ?`;
        values.push(`%${String(filters.name).trim()}%`);
    }
    if(filters.dateOfBirth)
    {
        if (!isValidDate(filters.dateOfBirth)) throw new HttpError(400, "Invalid dateOfBirthFrom, expected YYYY-MM-DD");
        quary += ` AND DateOfBirth > ?`;
        values.push(filters.dateOfBirth);
    }
    if (filters.email) {
        if(!EMAIL_REGEX.test(filters.email)){ throw new HttpError(400, "Invalid email format")}
        quary += ` AND Email = ?`;
        values.push(String(filters.email).trim());
    }

    if (filters.phone) {
        if(!PHONE_REGEX.test(filters.phone)){ throw new HttpError(400, "Invalid phone format")}
        quary += ` AND PhoneNum = ?`;
        values.push(String(filters.phone).trim());
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
        values.push(String(body.FullName).trim());
    }
    if(body.DateOfBirth)
    {
        if (!isValidDate(body.DateOfBirth)) throw new HttpError(400, "Invalid dateOfBirthFrom, expected YYYY-MM-DD");
        updateParams.push(`DateOfBirth = ?`);
        values.push(body.DateOfBirth);
    }
    if(body.Email)
    {
        if(!EMAIL_REGEX.test(body.Email)){ throw new HttpError(400, "Invalid email format")}
        updateParams.push(`Email = ?`);
        values.push(body.Email);
    }
    if(body.PhoneNum)
    {
        if(!PHONE_REGEX.test(body.PhoneNum)){ throw new HttpError(400, "Invalid email format")}
        updateParams.push(`PhoneNum = ?`);
        values.push(body.PhoneNum);
    }

    quary += updateParams.join(', ');
    quary += ` WHERE idClient = ?`;
    values.push(id);

    await pool.query(quary, values);
    return getClient(id);
}

export async function addClient(body) {
    const FullName = body?.FullName != null ? String(body.FullName).trim() : null;
    const DateOfBirth = body?.DateOfBirth ?? null;
    const Email = body?.Email != null ? String(body.Email).trim() : null;
    const PhoneNum = body?.PhoneNum != null ? String(body.PhoneNum).trim() : null;

    if (!FullName || !DateOfBirth || !PhoneNum || !Email) {
        throw new HttpError(400, "FullName, DateOfBirth, PhoneNum, Email are required");
    }
    if(!isValidDate(DateOfBirth))
    {
        console.log(DateOfBirth);
        throw new HttpError(400, "Invalid date format");
    }
    if(!EMAIL_REGEX.test(Email))
    {
        throw new HttpError(400, "Invalid email format");
    }
    if(!PHONE_REGEX.test(PhoneNum))
    {
        throw new HttpError(400, "Invalid phone number format");
    }


    const [res] = await pool.query(`
        INSERT INTO clients (FullName, DateOfBirth, PhoneNum, Email)
        VALUES (?, ?, ?, ?)    
    `, [FullName, DateOfBirth, PhoneNum, Email]);
    
    const id = res.insertId;
    return getClient(id);
}
