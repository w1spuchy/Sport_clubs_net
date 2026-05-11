import { HttpError } from "../utils/HttpError.js";
import { withTransaction } from "../utils/withTransaction.js";

export async function createSubscriptionPlan(body) {
  const { subscription} = body ?? {};
  if (!subscription) throw new HttpError(400, "subscription is required");

  const { subName, subType, subExpireType, coast, visitsAmount, validityPeriodInSec } = subscription;

  if (!subName || !subType || !subExpireType) {
    throw new HttpError(400, "subName, subType, subExpireType are required");
  }
  if (!coast || Number(coast) <= 0) throw new HttpError(400, "coast must be > 0");
  const EXPIRE_TYPES = ['By Time', 'By Visits'];
  if(!EXPIRE_TYPES.includes(subExpireType)){
    throw new HttpError(400, "subExpireType is wrong")
  }   
  if (visitsAmount == null && validityPeriodInSec == null) {
    throw new HttpError(400, "Either visitsAmount or validityPeriodInSec must be provided");
  }
  if(visitsAmount != null && validityPeriodInSec != null){
    throw new HttpError(400, "Sub Type must be only one");
  }


  return withTransaction(async (conn) => {
    const [sType] = await conn.query(
      `SELECT 1 FROM ref_sub_types WHERE SubType = ? LIMIT 1`,
      [subType]
    );
    if (!sType[0]) throw new HttpError(409, "SubType not found in ref_sub_types", { subType });
    
    const [zoneTypes] = await conn.query(`
        SELECT JSON_ARRAYAGG(ZoneType) AS Zones
        FROM ZoneAccess
        WHERE SubType = ?
        GROUP BY SubType`, [subType]);

    const [duplicate] = await conn.query(
      `SELECT 1 FROM Subscriptions WHERE SubName = ? LIMIT 1`,
      [subName]
    );
    if (duplicate[0]) throw new HttpError(409, "SubName already exists", { subName });

    const [insSub] = await conn.query(
      `INSERT INTO Subscriptions (SubName, SubType, SubExpireType, Coast, VisitAmount, ValidityPeriodInSec)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [subName, subType, subExpireType, coast, visitsAmount ?? null, validityPeriodInSec ?? null]
    );

    return { idSubscription: insSub.insertId, subName, subType, zoneTypes };
  });
}

export async function replaceZoneAccessForSubType(subType, body) {
  const { zoneTypes } = body ?? {};
  if (!Array.isArray(zoneTypes)) throw new HttpError(400, "zoneTypes must be an array");

  return withTransaction(async (conn) => {
    const [countOfActiveSubs] = await conn.query(
      `SELECT COUNT(*) AS cnt
       FROM ActiveSubscriptions a
       JOIN Subscriptions s USING(idSubscription)
       WHERE s.SubType = ?
         AND a.SubscriptionStatus = 'Active'`,
      [subType]
    );
    if (Number(countOfActiveSubs[0].cnt) > 0) {
      throw new HttpError(409, "Active subscriptions exist for this subType, cannot change access", {
        subType, activeCount: Number(countOfActiveSubs[0].cnt),
      });
    }

    if (zoneTypes.length > 0) {
      const placeholders = zoneTypes.map(() => "?").join(",");
      const [dbZoneTypes] = await conn.query(
        `SELECT ZoneType FROM ref_zone_types WHERE ZoneType IN (${placeholders})`,
        zoneTypes
      );
      if (dbZoneTypes.length !== zoneTypes.length) {
        throw new HttpError(409, "Some zoneTypes not found in ref_zone_types", { zoneTypes });
      }
    }

    await conn.query(`DELETE FROM ZoneAccess WHERE SubType = ?`, [subType]);

    if (zoneTypes.length > 0) {
      const values = zoneTypes.map((z) => [z, subType]);
      await conn.query(`INSERT INTO ZoneAccess (ZoneType, SubType) VALUES ?`, [values]);
    }

    return { subType, zoneTypes };
  });
}