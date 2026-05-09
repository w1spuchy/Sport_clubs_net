import { HttpError } from "../utils/HttpError.js";
import { withTransaction } from "../utils/withTransaction.js";

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