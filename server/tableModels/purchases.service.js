import pool from "../dataBase.js";
import { HttpError } from "../utils/HttpError.js";
import { withTransaction } from "../utils/withTransaction.js";

export async function getTransactionsAndSubs() {
  const [res] = await pool.query(`
    SELECT
      t.idTransaction,
      t.idAdmin,
      t.idClient AS transaction_idClient,
      t.idActiveSubscription,
      t.TransactionSum,
      t.PaymentMethod,
      t.TransactionDate,
      a.idClient AS activeSub_idClient,
      a.idSubscription,
      a.SubscriptionStatus,
      a.VisitsCount,
      a.PurchaseDate
    FROM Transactions t
    JOIN ActiveSubscriptions a
      ON a.idActiveSubscription = t.idActiveSubscription
  `);

  return res.map(r => ({
    transaction: {
      idTransaction: r.idTransaction,
      idAdmin: r.idAdmin,
      idClient: r.transaction_idClient,
      idActiveSubscription: r.idActiveSubscription,
      transactionSum: r.TransactionSum,
      paymentMethod: r.PaymentMethod,
      transactionDate: r.TransactionDate,
    },
    activeSubscription: {
      idActiveSubscription: r.idActiveSubscription,
      idClient: r.activeSub_idClient,
      idSubscription: r.idSubscription,
      subscriptionStatus: r.SubscriptionStatus,
      visitsCount: r.VisitsCount,
      purchaseDate: r.PurchaseDate,
    }
  }));
}

export async function buySubscription(body)
{
  const { idClient, idSubscription, idAdmin, paymentMethod } = body ?? {};
  const ALLOWED_PAYMENT = new Set(["Cash", "Card"]);

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

    const [duplicate] = await conn.query(
      `SELECT 1
       FROM activeSubscriptions
       WHERE idClient = ?
         AND idSubscription = ?
         AND SubscriptionStatus = 'Active'
       LIMIT 1`,
      [idClient, idSubscription]
    );
    if (duplicate[0]) throw new HttpError(409, "Active subscription already exists for this client and plan");

    const [insActive] = await conn.query(
      `INSERT INTO activeSubscriptions (
        idClient, idSubscription, SubscriptionStatus, VisitsCount, PurchaseDate
      )
      VALUES (?, ?, 'Active', 0, CURRENT_TIMESTAMP(2))`,
      [idClient, idSubscription]
    );
    const activeSubscriptionId = insActive.insertId;

    const [insTransaction] = await conn.query(
      `INSERT INTO transactions (
        idAdmin, idClient, idActiveSubscription,
        TransactionSum, PaymentMethod, TransactionDate
      )
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP(2))`,
      [idAdmin, idClient, activeSubscriptionId, sub.Coast, paymentMethod]
    );

    return {
      activeSubscriptionId,
      transactionId: insTransaction.insertId,
      idClient,
      idSubscription,
      status: "Active",
      paymentMethod,
    };
  });
}