import { HttpError } from "../utils/HttpError.js";
import { withTransaction } from "../utils/withTransaction.js";

const ALLOWED_PAYMENT = new Set(["Cash", "Card"]);

export async function buySubscription(body)
{
    const { idClient, idSubscription, idAdmin, paymentMethod } = body ?? {};

    if (!idClient || !idSubscription || !idAdmin || !paymentMethod) {
        throw new HttpError(400, "idClient, idSubscription, idAdmin, paymentMethod are required");
    }
    if (!ALLOWED_PAYMENT.has(paymentMethod)) {
        throw new HttpError(400, "Invalid paymentMethod", { allowed: [...ALLOWED_PAYMENT] });
    }

  return withTransaction(async (conn) => {
    const [client] = await conn.query(
      `SELECT idClient FROM clients WHERE idClient = ?`,
      [idClient]
    );
    if (!client[0]) throw new HttpError(404, "Client not found");

    let [sub] = await conn.query(
      `SELECT idSubscription, Coast
       FROM subscriptions
       WHERE idSubscription = ?`,
      [idSubscription]
    );
    sub = sub[0];
    if (!sub) throw new HttpError(404, "Subscription not found");
    if (!sub.Coast || sub.Coast <= 0) throw new HttpError(409, "Subscriptions.Coast must be > 0");

    const [admin] = await conn.query(
      `SELECT idEmployee FROM admins WHERE idEmployee = ?`,
      [idAdmin]
    );
    if (!admin[0]) throw new HttpError(404, "Admin not found");

    const [dup] = await conn.query(
      `SELECT 1
       FROM activeSubscriptions
       WHERE idClient = ?
         AND idSubscription = ?
         AND SubscriptionStatus = 'Active'
       LIMIT 1`,
      [idClient, idSubscription]
    );
    if (dup[0]) throw new HttpError(409, "Active subscription already exists for this client and plan");

    const [insActive] = await conn.query(
      `INSERT INTO activeSubscriptions (
        idClient, idSubscription, SubscriptionStatus, VisitsCount, PurchaseDate
      )
      VALUES (?, ?, 'Active', 0, CURRENT_TIMESTAMP(2))`,
      [idClient, idSubscription]
    );
    const activeSubscriptionId = insActive.insertId;

    const [insTr] = await conn.query(
      `INSERT INTO transactions (
        idAdmin, idClient, idActiveSubscription,
        TransactionSum, PaymentMethod, TransactionDate
      )
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP(2))`,
      [idAdmin, idClient, activeSubscriptionId, sub.Coast, paymentMethod]
    );

    return {
      activeSubscriptionId,
      transactionId: insTr.insertId,
      idClient,
      idSubscription,
      status: "Active",
      paymentMethod,
    };
  });
}