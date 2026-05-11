import pool from "../dataBase.js";
import { HttpError } from "../utils/HttpError.js";
import { withTransaction } from "../utils/withTransaction.js";

export async function getClubs() {
  const [clubs] = await pool.query(
    `SELECT idClub,
            ClubName,
            ClubAddress,
            OpeningTime,
            ClosingTime
     FROM clubs  
     ORDER BY idClub`
  );

  return clubs;
}

export async function getClubById(idClub) {
  const [rows] = await pool.query(
    `SELECT idClub,
            ClubName,
            ClubAddress,
            OpeningTime,
            ClosingTime
     FROM clubs 
     WHERE idClub = ?`,
    [idClub]
  );

  const club = rows[0];
  if (!club) throw new HttpError(404, "Club not found");

  const [zones] = await pool.query(`
    SELECT idZone, ZoneType
    FROM zones
    WHERE idClub = ?
    `, idClub);

  return {
    club: club,
    zones: zones ?? null
  };
}


export async function patchClubById(idClub, body) {
  const current = await getClubById(idClub);

  const next = {
    ClubName: body.ClubName ?? current.ClubName,
    ClubAddress: body.ClubAddress ?? current.ClubAddress,
    OpeningTime: body.OpeningTime ?? current.OpeningTime,
    ClosingTime: body.ClosingTime ?? current.ClosingTime,
  };

  const openStr = String(next.OpeningTime).length === 5 ? `${next.OpeningTime}:00` : String(next.OpeningTime);
  const closeStr = String(next.ClosingTime).length === 5 ? `${next.ClosingTime}:00` : String(next.ClosingTime);

  if (openStr >= closeStr) {
    throw new HttpError(409, "OpeningTime must be earlier than ClosingTime");
  }

  const updateParams = [];
  const values = [];

  if (body.ClubName != null) { updateParams.push("ClubName = ?"); values.push(body.ClubName); }
  if (body.ClubAddress != null) { updateParams.push("ClubAddress = ?"); values.push(body.ClubAddress); }
  if (body.OpeningTime != null) { updateParams.push("OpeningTime = ?"); values.push(body.OpeningTime); }
  if (body.ClosingTime != null) { updateParams.push("ClosingTime = ?"); values.push(body.ClosingTime); }

  if (updateParams.length === 0) return current;
  values.push(idClub);

  await pool.query(
    `UPDATE clubs SET ${updateParams.join(", ")} WHERE idClub = ?`,
    values
  );

  return getClubById(idClub);
}

export async function deleteClubByIdSafe(idClub) {
  return withTransaction(async (conn) => {
    const [clubs] = await conn.query(`SELECT idClub FROM Clubs WHERE idClub = ?`, [idClub]);
    if (!clubs[0]) throw new HttpError(404, "Club not found");

    const [[employeeCnt]] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM Employees WHERE idClub = ?`,
      [idClub]
    );
    if (Number(employeeCnt.cnt) > 0) {
      throw new HttpError(409, "Cannot delete club: employees exist", { employeesCount: Number(employeeCnt.cnt) });
    }

    const [[zoneCnt]] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM Zones WHERE idClub = ?`,
      [idClub]
    );
    if (Number(zoneCnt.cnt) > 0) {
      throw new HttpError(409, "Cannot delete club: zones exist", { zonesCount: Number(zoneCnt.cnt) });
    }

    await conn.query(`DELETE FROM сlubs WHERE idClub = ?`, [idClub]);
  });
}