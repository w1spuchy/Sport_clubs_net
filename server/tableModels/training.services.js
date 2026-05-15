import pool from "../dataBase.js";
import { HttpError } from "../utils/HttpError.js";
import { withTransaction } from "../utils/withTransaction.js";
import { minutesToSeconds, isDateWithinWorkingHours } from "../utils/time.js";

function toDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, "Invalid date", { value: value });
  return date;
}

export async function getTrainings()
{
  const [trainings] = await pool.query(
    `
      SELECT 
              tr.idTraining,
              train.idEmployee AS idTrainer,
              CONCAT(train.Surname,' ', train.Name) AS FullName,
              z.idZone,
              z.ZoneType,
              tr.TrainingType,
              tr.TrainingDate,
              tr.TrainingDuration,
              tr.MaxCapacity,
              tr.Status
      FROM training tr
      JOIN employees train ON train.idEmployee = tr.idTrainer
      JOIN zones z ON z.idZone = tr.idZone;
    `);
  return trainings;
}

export async function getTrainingInfo(idTraining) {
  const [training] = await pool.query(`
      SELECT 
              tr.idTraining,
              train.idEmployee AS idTrainer,
              CONCAT(train.Surname,' ', train.Name) AS FullName,
              z.idZone,
              z.ZoneType,
              tr.TrainingType,
              tr.TrainingDate,
              tr.TrainingDuration,
              tr.MaxCapacity,
              tr.Status
      FROM training tr
      JOIN employees train ON train.idEmployee = tr.idTrainer
      JOIN zones z ON z.idZone = tr.idZone
      WHERE tr.idTraining = ?
    `, [idTraining]);
  if(!training[0])
  {
    throw new HttpError(404, "Training not found");
  }

  const [registrations] = await pool.query(`
    SELECT reg.idRegistrationForClass AS idRegistration,
           c.FullName
    FROM registrationsfortraining reg
    JOIN clients c USING(idClient) 
    WHERE idTraining = ?
    `, [idTraining])
  if(!registrations.length > 0)
  {
    throw new HttpError(404, "No registrations found");
  }

  return {
    training: training,
    registrations: registrations
  } 
}

export async function createTraining(body) {
  const { idTrainer, idZone, trainingType, trainingDate, trainingDuration, maxCapacity } = body ?? {};
  if (!idTrainer || !idZone || !trainingType || !trainingDate || trainingDuration == null || !maxCapacity) {
    throw new HttpError(400, "idTrainer, idZone, trainingType, trainingDate, trainingDuration, maxCapacity are required");
  }

  const start = toDate(trainingDate);
  if (start <= new Date()) throw new HttpError(409, "TrainingDate must be in the future");

  let durationSec;
  try { durationSec = minutesToSeconds(trainingDuration); }
  catch { throw new HttpError(400, "trainingDuration must be minutes > 0"); }

  if (Number(maxCapacity) <= 0) throw new HttpError(400, "maxCapacity must be > 0");

  return withTransaction(async (conn) => {
    const [trainerRow] = await conn.query(
      `SELECT e.idClub AS trainerClubId
       FROM trainers t
       JOIN Employees e USING(idEmployee)
       WHERE t.idEmployee = ?`,
      [idTrainer]
    );
    if (!trainerRow[0]) throw new HttpError(404, "Trainer not found");

    const [zoneRow] = await conn.query(
      `SELECT idClub AS zoneClubId, Capacity, ZoneType
       FROM zones
       WHERE idZone = ?`,
      [idZone]
    );
    if (!zoneRow[0]) throw new HttpError(404, "Zone not found");
    if (trainerRow[0].trainerClubId !== zoneRow[0].zoneClubId) {
      throw new HttpError(409, "Trainer and Zone are in different clubs");
    }
    if (Number(maxCapacity) > Number(zoneRow[0].Capacity)) {
      throw new HttpError(409, "Max Capacity > Zone Capacity", { zoneCapacity: zoneRow[0].Capacity });
    }

    const [clubRow] = await conn.query(
      `SELECT OpeningTime, ClosingTime FROM clubs WHERE idClub = ?`,
      [zoneRow[0].zoneClubId]
    );
    if (!clubRow[0]) throw new HttpError(409, "Club not found");
    if (!isDateWithinWorkingHours(start, durationSec, clubRow[0].OpeningTime, clubRow[0].ClosingTime)) {
      throw new HttpError(409, "Training is outside club working hours");
    }

    const [trainerIntersect] = await conn.query(
    `
        SELECT 1 FROM training WHERE 
        idTrainer = ?
        AND ? < DATE_ADD(TrainingDate, INTERVAL TIME_TO_SEC(TrainingDuration) SECOND)
        AND TrainingDate < DATE_ADD(?, INTERVAL ? SECOND)
        LIMIT 1
    `, [idTrainer, start, start, durationSec])
    if (trainerIntersect.length > 0) throw new HttpError(409, "Trainer has intersection");

    const [zoneIntersect] = await conn.query(
    `
        SELECT 1 FROM training WHERE
        idZone = ?
        AND ? < DATE_ADD(TrainingDate, INTERVAL TIME_TO_SEC(TrainingDuration) SECOND)
        AND TrainingDate < DATE_ADD(?, INTERVAL ? SECOND)
    `, [idZone, start, start, durationSec])
    if (zoneIntersect.length > 0) throw new HttpError(409, "Zone has intersection");
    
    const TRAINING_ZONE_MAP = {
      Yoga: ["Yoga Zone"],
      Crossfit: ["Crossfit Zone", "Gym"],
      Swimming: ["Swimming Pool"],
      PowerLifting: ["Gym"],
      Boxing: ["Boxing Zone"],
    };
    const zoneType = zoneRow[0].ZoneType;
    const allowedZones = TRAINING_ZONE_MAP[trainingType];
    if (!allowedZones) {
      throw new HttpError(400, "Unknown trainingType", { trainingType });
    }
    const isAllowed = allowedZones.includes(zoneType);
    if (!isAllowed) {
      throw new HttpError(403, "Zone type and training type dont match", {
        trainingType,
        zoneType,
        allowedZones,
      });
    }

    const [ins] = await conn.query(
      `INSERT INTO training (idTrainer, idZone, TrainingType, TrainingDate, TrainingDuration, MaxCapacity)
       VALUES (?, ?, ?, ?, SEC_TO_TIME(?), ?)`,
      [idTrainer, idZone, trainingType, start, durationSec, maxCapacity]
    );

    return {
      idTraining: ins.insertId,
      idTrainer,
      idZone,
      trainingType,
      trainingDate: start.toISOString(),
      trainingDuration: Number(trainingDuration), 
      maxCapacity: Number(maxCapacity),
    };
  });
}

export async function patchTraining(idTraining, body) {
  if (!idTraining) throw new HttpError(400, "idTraining is required");

  return withTransaction(async (conn) => {
    const [trainingRows] = await conn.query(
      `SELECT idTraining, idTrainer, idZone, TrainingType, TrainingDate,
              TIME_TO_SEC(TrainingDuration) AS durationSec,
              MaxCapacity, Status AS status
       FROM training
       WHERE idTraining = ?`,
      [idTraining]
    );
    const training = trainingRows[0];
    if (!training) throw new HttpError(404, "Training not found");
    if (new Date(training.TrainingDate) <= new Date()) throw new HttpError(409, "Training already started");

    const [registrationCountrainerRow] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM registrationsfortraining WHERE idTraining = ?`,
      [idTraining]
    );
    const regCount = Number(registrationCountrainerRow[0].cnt);

    if (regCount > 0 && (body.idTrainer || body.idZone || body.trainingDate)) {
      throw new HttpError(409, "Cannot change trainer/zone/date when registrations exist", { registrations: regCount });
    }

    const next = {
      idTrainer: body.idTrainer ?? training.idTrainer,
      idZone: body.idZone ?? training.idZone,
      trainingDate: body.trainingDate ? toDate(body.trainingDate) : new Date(training.TrainingDate),
      durationSec: training.durationSec,
      maxCapacity: body.maxCapacity ?? training.MaxCapacity,
      status: body.status ?? training.status
    };

    if (body.trainingDuration != null) {
      try { next.durationSec = minutesToSeconds(body.trainingDuration); }
      catch { throw new HttpError(400, "trainingDuration must be minutes > 0"); }
    }

    if (Number(next.maxCapacity) < regCount) {
      throw new HttpError(409, "maxCapacity is less than current registrations", { regCount });
    }

    const [zoneRow] = await conn.query(
      `SELECT idClub, Capacity FROM zones WHERE idZone = ?`,
      [next.idZone]
    );
    if (!zoneRow[0]) throw new HttpError(404, "Zone not found");
    if (Number(next.maxCapacity) > Number(zoneRow[0].Capacity)) {
      throw new HttpError(409, "Max Capacity > Zone Capacity", { zoneCapacity: zoneRow[0].Capacity });
    }

    const [trainerRow] = await conn.query(
      `SELECT e.idClub AS trainerClubId
       FROM trainers t
       JOIN employees e USING(idEmployee)
       WHERE t.idEmployee = ?`,
      [next.idTrainer]
    );
    if (!trainerRow[0]) throw new HttpError(404, "Trainer not found");
    if (trainerRow[0].trainerClubId !== zoneRow[0].idClub) {
      throw new HttpError(409, "Trainer and Zone are in different clubs");
    }

    const [clubRow] = await conn.query(
      `SELECT OpeningTime, ClosingTime FROM clubs WHERE idClub = ?`,
      [zoneRow[0].idClub]
    );
    if (!isDateWithinWorkingHours(next.trainingDate, next.durationSec, clubRow[0].OpeningTime, clubRow[0].ClosingTime)) {
      throw new HttpError(409, "Training is outside club working hours");
    }

    const [trainerIntersect] = await conn.query(
    `
        SELECT 1 FROM training WHERE
        idTrainer = ?
        AND idTraining <> ?
        AND ? < DATE_ADD(TrainingDate, INTERVAL TIME_TO_SEC(TrainingDuration) SECOND)
        AND TrainingDate < DATE_ADD(?, INTERVAL ? SECOND)
    `, [next.idTrainer, idTraining, next.trainingDate, next.trainingDate, next.durationSec])
    if (trainerIntersect.length > 0) throw new HttpError(409, "Trainer has intersection");

    const [zoneIntersect] = await conn.query(
    `
        SELECT 1 FROM training WHERE
        idZone = ?
        AND idTraining <> ?
        AND ? < DATE_ADD(TrainingDate, INTERVAL TIME_TO_SEC(TrainingDuration) SECOND)
        AND TrainingDate < DATE_ADD(?, INTERVAL ? SECOND)
    `,[next.idZone, idTraining, next.trainingDate, next.trainingDate, next.durationSec])
    if (zoneIntersect.length > 0) throw new HttpError(409, "Zone has intersection");

    const AVAILABLE_TRAINING_STATUS = new Set(['Scheduled','Cancelled']);
    if(!AVAILABLE_TRAINING_STATUS.has(next.status)) throw new HttpError(409, "Wrong training status");
    if(next.status === "Scheduled")
    {
        const startDate = new Date(next.trainingDate);
        const endDate = new Date(startDate.getTime() + next.durationSec * 1000);
        const now = new Date();

        if (endDate < now) {
            next.status = "Completed";
        }
    }

    await conn.query(
      `UPDATE training
       SET idTrainer = ?,
           idZone = ?,
           TrainingDate = ?,
           TrainingDuration = SEC_TO_TIME(?),
           MaxCapacity = ?,
           Status = ?
       WHERE idTraining = ?`,
      [next.idTrainer, next.idZone, next.trainingDate, next.durationSec, next.maxCapacity, next.status, idTraining]
    );

    return {
      idTraining: Number(idTraining),
      idTrainer: next.idTrainer,
      idZone: next.idZone,
      trainingDate: next.trainingDate,
      trainingDuration: Math.round(next.durationSec / 60),
      maxCapacity: Number(next.maxCapacity),
      trainingStatus: next.status
    };
  });
}

export async function deleteTraining(idTraining) {
  if (!idTraining) throw new HttpError(400, "idTraining is required");

  return withTransaction(async (conn) => {
    const [trainingRow] = await conn.query(
      `SELECT TrainingDate FROM training WHERE idTraining = ?`,
      [idTraining]
    );
    const training = trainingRow[0];
    if (!training) throw new HttpError(404, "Training not found");
    if (new Date(training.TrainingDate) <= new Date()) throw new HttpError(409, "Training already started");

    const [countRegRow] = await conn.query(
      `SELECT COUNT(*) AS cnt
       FROM registrationsfortraining
       WHERE idTraining = ?`,
      [idTraining]
    );
    if (Number(countRegRow[0].cnt) > 0) throw new HttpError(409, "Cannot delete training with registrations");

    await conn.query(`DELETE FROM Training WHERE idTraining = ?`, [idTraining]);
  });
}

export async function registerForTraining(idTraining, body) {
  const { idClient } = body ?? {};
  if (!idClient) throw new HttpError(400, "idClient is required");

  return withTransaction(async (conn) => {
    const [clients] = await conn.query(`SELECT idClient FROM clients WHERE idClient = ?`, [idClient]);
    if (!clients[0]) throw new HttpError(404, "Client not found");

    const [trainingRow] = await conn.query(
      `SELECT idTraining, idZone, TrainingDate, MaxCapacity, Status
       FROM Training
       WHERE idTraining = ?`,
      [idTraining]
    );
    const training = trainingRow[0];
    if (!training) throw new HttpError(404, "Training not found");
    if(training.Status === "Cancelled") throw new HttpError(409, "Training is cancelled"); 
    if(training.Status === "Completed") throw new HttpError(409, "Training is completed"); 
    if (new Date(training.TrainingDate) <= new Date()) throw new HttpError(409, "Training already started");

    const [duplicate] = await conn.query(
      `SELECT 1
       FROM registrationsfortraining
       WHERE idClient = ? AND idTraining = ?
       LIMIT 1`,
      [idClient, idTraining]
    );
    if (duplicate[0]) throw new HttpError(409, "Client already registered");

    const [countRegRow] = await conn.query(
      `SELECT COUNT(*) AS cnt
       FROM registrationsfortraining
       WHERE idTraining = ?`,
      [idTraining]
    );
    if (Number(countRegRow[0].cnt) >= Number(training.MaxCapacity)) throw new HttpError(409, "No free places");

    const [accessRows] = await conn.query(
      `SELECT a.idActiveSubscription
       FROM activeSubscriptions a
       JOIN subscriptions s ON s.idSubscription = a.idSubscription
       JOIN training tr ON tr.idTraining = ?
       JOIN zones z ON z.idZone = tr.idZone
       JOIN zoneAccess za ON za.SubType = s.SubType AND za.ZoneType = z.ZoneType
       WHERE a.idClient = ?
         AND a.SubscriptionStatus = 'Active'
         AND (s.VisitAmount IS NULL OR a.VisitsCount < s.VisitAmount)
         AND (s.ValidityPeriodInSec IS NULL
              OR CURRENT_TIMESTAMP <= DATE_ADD(a.PurchaseDate, INTERVAL s.ValidityPeriodInSec SECOND))
       LIMIT 1`,
      [idTraining, idClient]
    );
    if (!accessRows[0]) throw new HttpError(403, "No access to training zone by active subscription");

    const [ins] = await conn.query(
      `INSERT INTO registrationsfortraining (idClient, idTraining, ClassDate)
       VALUES (?, ?, ?)`,
      [idClient, idTraining, training.TrainingDate]
    );

    return {
      idRegistrationForClass: ins.insertId,
      idClient,
      idTraining: Number(idTraining),
      classDate: new Date(training.TrainingDate).toISOString(),
    };
  });
}

export async function cancelRegistration(idRegistrationForClass) {
  if (!idRegistrationForClass) throw new HttpError(400, "idRegistrationForClass is required");

  return withTransaction(async (conn) => {
    const [regs] = await conn.query(
      `SELECT idRegistrationForClass, idTraining
       FROM registrationsfortraining
       WHERE idRegistrationForClass = ?`,
      [idRegistrationForClass]
    );
    const reg = regs[0];
    if (!reg) throw new HttpError(404, "Registration not found");

    const [trainings] = await conn.query(
      `SELECT TrainingDate FROM training WHERE idTraining = ?`,
      [reg.idTraining]
    );
    const training = trainings[0];
    if (!training) throw new HttpError(404, "Training not found for this registration");
    if (new Date(training.TrainingDate) <= new Date()) throw new HttpError(409, "Training already started");

    await conn.query(
      `DELETE FROM registrationsfortraining
       WHERE idRegistrationForClass = ?`,
      [idRegistrationForClass]
    );

    return {
        idRegistrationForClass: idRegistrationForClass,
        deleteStatus: "success"
    }
  });
}