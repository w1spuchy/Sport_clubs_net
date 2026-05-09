import pool from "../db/pool.js";

export async function withTransaction(work) {
  const conn = await pool.getConnection();
  try 
  {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } 
  catch (e) 
  {
    await conn.rollback();
    throw e;
  } 
  finally {
    conn.release();
  }
}