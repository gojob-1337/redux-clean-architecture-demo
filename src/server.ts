import express from 'express';

const app = express();

app.use(express.json());

app.post('/validate-question', (req, res) => {
  console.log(req.body);
  res.status(201).end();
});

app.listen(3000);
