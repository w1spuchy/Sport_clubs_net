import pool from "../dataBase.js";
import { HttpError } from "../utils/HttpError.js";
import { withTransaction } from "../utils/withTransaction.js";

export async function getEmployees() {
    const [employees] = await pool.query(`
        SELECT * FROM employees 
        LEFT JOIN trainers USING(idEmployee)
        LEFT JOIN admins USING(idEmployee)
        ORDER BY idClub`
    );
    return employees;
} 

export async function getTrainers() {
    const [trainers] = await pool.query(`
        SELECT * FROM employees 
        JOIN trainers USING(idEmployee)
        ORDER BY idClub`
    );
    return trainers;
} 

export async function getAdmins() {
    const [admins] = await pool.query(`
        SELECT * FROM employees 
        JOIN admins USING(idEmployee)
        ORDER BY idClub`
    );
    return admins;
} 

export async function getEmployeeById(EmployeeId) {
    const [employee] = await pool.query(`
        SELECT * FROM employees 
        LEFT JOIN trainers USING(idEmployee)
        LEFT JOIN admins USING(idEmployee)
        WHERE idEmployee = ?
        ORDER BY idClub`, [EmployeeId]
    );
    if(!employee[0])
    {
      throw new HttpError(404, "No employee with this id");
    }
    return employee;
}

export async function deleteEmployeeById(EmployeeId) {
    const [employee] = await pool.query(`
        SELECT * FROM employees 
        LEFT JOIN trainers USING(idEmployee)
        LEFT JOIN admins USING(idEmployee)
        WHERE idEmployee = ?
        ORDER BY idClub`, [EmployeeId]
    );

    if(!employee[0])
    {
      throw new HttpError(404, "No employee with this id");
    }

    await pool.query(`
      DELETE FROM employees WHERE idEmployee = ?`, [EmployeeId]);

    return { employee, deleteStatus: "deleted"};
}

export async function createTrainer(body) {
  const { employee, trainer } = body ?? {};
  if (!employee || !trainer) throw new HttpError(400, "employee and trainer are required");

  return withTransaction(async (conn) => {
    const [clubs] = await conn.query(`SELECT idClub FROM Clubs WHERE idClub = ?`, [employee.idClub]);
    if (!clubs[0]) throw new HttpError(404, "Club not found");

    if(!Array.isArray(employee.workingDays))
    {
        throw new HttpError(409, "Working days isn't SET")
    }
    const WORKING_DAYS = new Set(['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);
    employee.workingDays.forEach(day => {
        if(!WORKING_DAYS.has(day))
        {
            throw new HttpError(409, "Wrong working days SET");
        }
    });
    employee.workingDays = employee.workingDays.join(",");

    const [insEmp] = await conn.query(
      `INSERT INTO Employees (idClub, Surname, Name, PhoneNum, Email, Salary, WorkingDays, Shift)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employee.idClub,
        employee.surname,
        employee.name,
        employee.phoneNum,
        employee.email,
        employee.salary,
        employee.workingDays,
        employee.shift,
      ]
    );
    const idEmployee = insEmp.insertId;

    if(!Array.isArray(trainer.specification))
    {
        throw new HttpError(409, "Specification isn't SET")
    }
    const SPECIFICATIONS = new Set(['Yoga','Crossfit','Swimming','Power Lifting','Boxing','Gymnastics']);
    trainer.specification.forEach(spec => {
        if(!SPECIFICATIONS.has(spec))
        {
            throw new HttpError(409, "Wrong specification SET");
        }
    });
    trainer.specification = trainer.specification.join(",");

    await conn.query(
      `INSERT INTO Trainers (idEmployee, Specification, Qualification, HireDate)
       VALUES (?, ?, ?, ?)`,
      [
        idEmployee,
        trainer.specification,
        trainer.qualification,
        trainer.hireDate,
      ]
    );

    return { idEmployee, role: "Trainer" };
  });
}

export async function createAdmin(body) {
  const { employee, admin } = body ?? {};
  if (!employee || !admin) throw new HttpError(400, "employee and admin are required");

  return withTransaction(async (conn) => {
    const [clubs] = await conn.query(`SELECT idClub FROM Clubs WHERE idClub = ?`, [employee.idClub]);
    if (!clubs[0]) throw new HttpError(404, "Club not found");

    if(!Array.isArray(employee.workingDays))
    {
        throw new HttpError(409, "Working days isn't SET")
    }
    const WORKING_DAYS = new Set(['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);
    employee.workingDays.forEach(day => {
        if(!WORKING_DAYS.has(day))
        {
            throw new HttpError(409, "Wrong working days SET");
        }
    });
    employee.workingDays = employee.workingDays.join(",");

    const [insEmp] = await conn.query(
      `INSERT INTO Employees (idClub, Surname, Name, PhoneNum, Email, Salary, WorkingDays, Shift)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employee.idClub,
        employee.surname,
        employee.name,
        employee.phoneNum,
        employee.email,
        employee.salary,
        employee.workingDays,
        employee.shift,
      ]
    );
    const idEmployee = insEmp.insertId;

    await conn.query(
      `INSERT INTO Admins (idEmployee, AccessLevel)
       VALUES (?, ?)`,
      [idEmployee, admin.accessLevel]
    );

    return { idEmployee, role: "Admin" };
  });
}