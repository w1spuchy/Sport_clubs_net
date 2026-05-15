import pool from "../dataBase.js";
import { HttpError } from "../utils/HttpError.js";
import { withTransaction } from "../utils/withTransaction.js";
import { isClubOpenNow } from "../utils/time.js";

export async function getClientVisits(idClient)
{
  const [client] = await pool.query(`
    SELECT 1 FROM clients WHERE idClient = ? LIMIT 1
    `, [idClient]);

  if(!client[0])
  {
    throw new HttpError(404, "Client not found");
  }

  const [visits] = await pool.query(`
    SELECT v.idVisit,
        c.idClient,
        c.FullName,
        z.idZone,
        z.ZoneType,
        v.EnterTime,
        v.OutTime
    FROM visits v
    JOIN clients c ON v.idClient = c.idClient
    JOIN zones z ON z.idZone = v.idZone 
    WHERE v.idClient = 1;
    `
    ,[idClient]);

  return visits;
}

export async function checkIn(body) {
  const { idClient, idZone, idActiveSubscription } = body ?? {};
  if (!idClient || !idZone || !idActiveSubscription) throw new HttpError(400, "idClient, idZone, idActiveSubscription are required");

  return withTransaction(async (conn) => {
    const [clients] = await conn.query(`SELECT idClient FROM clients WHERE idClient = ?`, [idClient]);
    if (!clients[0]) throw new HttpError(404, "Client not found");

    const [opened] = await conn.query(
      `SELECT idVisit FROM visits WHERE idClient = ? AND OutTime IS NULL`,
      [idClient]
    );
    if (opened[0]) throw new HttpError(409, "Client already has opened visit");

    let [zone] = await conn.query(
      `SELECT idZone, idClub, ZoneType, Capacity
       FROM zones
       WHERE idZone = ?`,
      [idZone]
    );
    zone = zone[0];
    if (!zone) throw new HttpError(404, "Zone not found");

    const [workingTime] = await conn.query(
      `SELECT OpeningTime, ClosingTime
       FROM clubs
       WHERE idClub = ?`,
      [zone.idClub]
    );
    if (!workingTime[0]) throw new HttpError(409, "Zone has invalid club reference");

    if (!isClubOpenNow(workingTime[0].OpeningTime, workingTime[0].ClosingTime)) {
      throw new HttpError(409, "Club is closed now");
    }

    const [cntRows] = await conn.query(
      `SELECT COUNT(*) AS cnt
       FROM visits
       WHERE idZone = ?
         AND OutTime IS NULL`,
      [idZone]
    );
    const currentVisitors = cntRows[0].cnt;
    if (currentVisitors >= zone.Capacity) {
      throw new HttpError(409, "Zone is full", { capacity: zone.Capacity, currentVisitors });
    }

    const [rows] = await conn.query(
    `SELECT a.idActiveSubscription, a.VisitsCount, s.VisitAmount
        FROM activeSubscriptions a
        JOIN subscriptions s USING(idSubscription)
        JOIN zones z ON z.idZone = ?
        JOIN zoneAccess za ON za.SubType = s.SubType AND za.ZoneType = z.ZoneType
        WHERE a.idActiveSubscription = ?
        AND a.idClient = ?
        AND a.SubscriptionStatus = 'Active'
        AND (s.VisitAmount IS NULL OR a.VisitsCount <= s.VisitAmount)
        AND (s.ValidityPeriodInSec IS NULL
            OR CURRENT_TIMESTAMP <= DATE_ADD(a.PurchaseDate, INTERVAL s.ValidityPeriodInSec SECOND))
    `,
    [idZone, idActiveSubscription, idClient]
    );
    const activeSub = rows[0];
    if (!activeSub) throw new HttpError(403, "No suitable active subscription for this zone");
    if (activeSub){
      if(activeSub.VisitsCount >= activeSub.VisitAmount)
      {
        await conn.query(`
          UPDATE activesubscriptions
          SET SubscriptionStatus = 'Expired'
          WHERE idActiveSubscription = ?
          `, [activeSub.idActiveSubscription]
        );
        throw new HttpError(403, "Your subscription is expired");
      }
     };


    const [ins] = await conn.query(
      `INSERT INTO visits (idClient, idZone, EnterTime, OutTime)
       VALUES (?, ?, CURRENT_TIMESTAMP(2), NULL)`,
      [idClient, idZone]
    );

    await conn.query(
      `UPDATE activeSubscriptions
       SET VisitsCount = VisitsCount + 1
       WHERE idActiveSubscription = ?`,
      [activeSub.idActiveSubscription]
    );

    const [visitRow] = await conn.query(
      `SELECT EnterTime
       FROM visits
       WHERE idVisit = ?`,
      [ins.insertId]
    );

    return {
      idVisit: ins.insertId,
      idClient,
      idZone,
      enterTime: visitRow[0]?.EnterTime,
      status: "Opened",
    };
  });
}

export async function checkOut(idVisit) {
  if (!idVisit) throw new HttpError(400, "idVisit is required");

  return withTransaction(async (conn) => {
    let [visit] = await conn.query(
      `SELECT idVisit, EnterTime, OutTime
       FROM visits
       WHERE idVisit = ?`,
      [idVisit]
    );
    visit = visit[0];
    if (!visit) throw new HttpError(404, "Visit not found");
    if (visit.OutTime !== null) throw new HttpError(409, "Visit already closed");

    const [upd] = await conn.query(
      `UPDATE visits
       SET OutTime = CURRENT_TIMESTAMP(2)
       WHERE idVisit = ?
         AND OutTime IS NULL
         AND CURRENT_TIMESTAMP(2) > EnterTime`,
      [idVisit]
    );
    if (upd.affectedRows === 0) throw new HttpError(409, "Cannot close visit (already closed or invalid time)");

    const [row] = await conn.query(
      `SELECT OutTime FROM visits WHERE idVisit = ?`,
      [idVisit]
    );

    return {
      idVisit: idVisit,
      status: "Closed",
      outTime: row[0]?.OutTime,
    };
  });
}