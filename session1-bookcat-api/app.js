const express = require('express');
const dbConfig = require("./dbConfig");
const sql = require('mssql');   
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
res.send('Welcome to the Book Category API');
});

app.get('/categories', (req, res) => {
    res.json([
        { id: 1, name: 'Fiction' },
        { id: 2, name: 'Non-Fiction' },
        { id: 3, name: 'Biography' }
    ]);
});

app.get('/about', (req, res) => {
    res.send('Hi my name is Gabriel Rafol and I am a Year 1 student studying Information Technology at Ngee Ann Polytechnic!')
});

// GET all authors
app.get('/authors', async (req, res) => {
  let connection;
  try {
    connection = await sql.connect(dbConfig);

    const result = await connection.request().query('SELECT AuthorID, Name FROM Author');
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    if (connection) await connection.close();
  }
});

// GET /authors/:id

app.get('/authors/:id', async (req, res) => {
    const authorID = parseInt(req.params.id);
    if (isNaN(authorID)) {
        return res.status(400).json({error: 'Invalid id'});
    }
    let connection;
    try {
        connection = await sql.connect(dbConfig);

        const request = connection.request();
        request.input('id', authorID);
        const sqlQuery = `SELECT AuthorID, Name
                          FROM Author
                          WHERE AuthorID = @id`;
        const result = await request.query(sqlQuery);
        if (result.recordset.length === 0) {
            return res.status(404).json({error: 'Not found'});
        }
        res.status(200).json(result.recordset[0]);
    } catch (err) {
      res.status(500).json({error: 'Database error'});
    } finally {
      if (connection) await connection.close();
    }
})

// POST /authors - insert a new row

app.post("/authors", async (req, res) => {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const request = connection.request();
        request.input("id", req.body.id);
        request.input("name", req.body.name);

        const sqlQuery =
            "INSERT INTO Author (AuthorID, Name) " +
            "VALUES (@id, @name)";

        const result = await request.query(sqlQuery);
        res.status(201).json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: 'Database error'});
    } finally {
        if (connection) await connection.close();
    }
});

// PUT /authors/:id - update an existing row

app.put("/authors/:id", async (req, res) => {
    let connection;
    try {
      connection = await sql.connect(dbConfig);
      const request = connection.request();
      request.input("id", parseInt(req.params.id));
      request.input("name", req.body.name);

      const sqlQuery = `UPDATE Author
            SET Name = @name
            WHERE AuthorID = @id`;

      const result = await request.query(sqlQuery);

      if (result.rowsAffected[0] === 0) {
        return res.status(404).json({ error: "Not found" });
      }
      res.status(200).json({ updated: true });
    } catch (err) {
      res.status(500).json({ error: "Database error" });
    } finally {
      if (connection) await connection.close();
    }
});

// DELETE /authors/:id - remove a row
app.delete("/authors/:id", async (req, res) => {
    let connection;
    try {
      connection = await sql.connect(dbConfig);
      const request = connection.request();
      request.input("id", parseInt(req.params.id));

      const sqlQuery = "DELETE FROM Author WHERE AuthorID = @id";
      const result = await request.query(sqlQuery);

      if (result.rowsAffected[0] === 0) {
        return res.status(404).json({ error: "Not found" });
      }
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Database error" });
    } finally {
      if (connection) await connection.close();
    }
});


app.listen(3000, async () => {
console.log('Listening on port 3000');

try {
    let dbConnection = await sql.connect(dbConfig)
    let result = (await dbConnection.request().query('SELECT @@SERVERNAME AS ServerName'));
    let serverInstance = result.recordset[0].ServerName
    console.log("Established connection to Database " + serverInstance);
} catch (err) {
        console.error("Database connection failed:", err);
}
});

