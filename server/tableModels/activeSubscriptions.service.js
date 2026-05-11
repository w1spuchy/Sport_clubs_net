import { HttpError } from "../utils/HttpError.js";
import { withTransaction } from "../utils/withTransaction.js";
import pool from '../dataBase.js';

export async function getActiveSubs(body) {
  const { SubscriptionStatus } = body;
  const SUBS_STATUSES = new Set(['Active','Blocked','Expired']);
  if(!SUBS_STATUSES.has(SubscriptionStatus)){
    throw new HttpError(409, "Invalid status value");
  }

  const [activeSubs] = await pool.query(`
    SELECT a.idActiveSubscription,
           s.SubName,
           c.FullName,
           a.SubscriptionStatus, 
           a.VisitsCount,
           a.PurchaseDate
    FROM activesubscriptions a
    JOIN clients c ON a.idClient = c.idClient  
    JOIN subscriptions s ON a.idSubscription = s.idSubscription
    WHERE a.SubscriptionStatus = ?
  `, [SubscriptionStatus]);

  return activeSubs;
}

export async function expireSubscriptions() {
    const [result] = await pool.query(
        `
        UPDATE activeSubscriptions AS a
        JOIN subscriptions AS s USING(idSubscription) 
        SET a.SubscriptionStatus = 'Expired'
        WHERE a.SubscriptionStatus = 'Active'
        AND 
        (
            (s.VisitAmount IS NOT NULL AND a.VisitsCount >= s.VisitAmount)
            OR
            (s.ValidityPeriodInSec IS NOT NULL
            AND CURRENT_TIMESTAMP > DATE_ADD(a.PurchaseDate, INTERVAL s.ValidityPeriodInSec SECOND))
        )`
    );

    return { expiredCount: result.affectedRows };
}

export async function cancelSubscription(idActiveSubscription) 
{
    if (!idActiveSubscription) throw new HttpError(400, "idActiveSubscription is required");

    return withTransaction(async (conn) => {
      let [sub] = await conn.query(
        `SELECT idActiveSubscription, idClient, SubscriptionStatus
        FROM ActiveSubscriptions
        WHERE idActiveSubscription = ?`,
        [idActiveSubscription]
      );
      sub = sub[0];
      if (!sub) throw new HttpError(404, "ActiveSubscription not found");

      if (sub.SubscriptionStatus !== "Active") {
        throw new HttpError(409, "SubscriptionStatus must be Active", { status: sub.SubscriptionStatus });
      }

      const [openVisit] = await conn.query(
        `SELECT 1
        FROM Visits
        WHERE idClient = ?
          AND OutTime IS NULL
        LIMIT 1`,
        [sub.idClient]
      );
      if (openVisit[0]) throw new HttpError(409, "Client has opened visit");

      await conn.query(
        `UPDATE ActiveSubscriptions
        SET SubscriptionStatus = 'Blocked'
        WHERE idActiveSubscription = ?`,
        [idActiveSubscription]
      );

      return { idActiveSubscription: idActiveSubscription, status: "Blocked" };
  });
}

