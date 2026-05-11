import express from 'express';
import { HttpError} from './utils/HttpError.js';

import clientsRoutes from './routes/clientsRouter.js';
import purchasesRouter from './routes/purchases.router.js';
import activeSubscriptionsRouter from './routes/activeSubscriptions.router.js';
import visitsRouter from './routes/visits.router.js';
import trainingsRouter from './routes/training.router.js'
import staffRouter from "./routes/staff.router.js";
import subRouter from "./routes/subscription.router.js";
import clubsRouter from "./routes/clubs.router.js";

const app = express()
app.use(express.json());

app.use('/api/clients', clientsRoutes);
app.use("/api/purchases", purchasesRouter);
app.use("/api/active-subscriptions", activeSubscriptionsRouter);
app.use("/api/visits", visitsRouter);
app.use("/api/trainings", trainingsRouter);
app.use("/api/staff", staffRouter);
app.use("/api/subscription", subRouter);
app.use("/api/clubs", clubsRouter);

app.use((req, res) => res.status(404).json({ error: "Not Found" }));

app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
})
app.listen(8080, ()=> {
    console.log('Server is running');
})