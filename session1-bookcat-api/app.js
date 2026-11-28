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

// GET all books
app.get('/books', async (req, res) => {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request().query(
      'SELECT ISBN, Title, YearPublish, PublisherID, BookCat FROM Book'
    );
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    if (connection) await connection.close();
  }
});

// GET one book by ISBN
app.get('/books/:isbn', async (req, res) => {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input('isbn', sql.Char(10), req.params.isbn);
    const result = await request.query(
      'SELECT ISBN, Title, YearPublish, PublisherID, BookCat FROM Book WHERE ISBN = @isbn'
    );
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.status(200).json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    if (connection) await connection.close();
  }
});

// POST a new book and its author, in one transaction
app.post('/books', async (req, res) => {
  const { isbn, title, yearPublish, publisherId, bookCat, authorId } = req.body;
  let connection;
  let transaction;
  try {
    connection = await sql.connect(dbConfig);
    transaction = new sql.Transaction(connection);
    await transaction.begin();

    const bookRequest = transaction.request();
    bookRequest.input('isbn', sql.Char(10), isbn);
    bookRequest.input('title', sql.VarChar(200), title);
    bookRequest.input('yearPublish', sql.Char(4), yearPublish);
    bookRequest.input('publisherId', sql.SmallInt, publisherId);
    bookRequest.input('bookCat', sql.Char(2), bookCat);
    const bookResult = await bookRequest.query(
      'INSERT INTO Book (ISBN, Title, YearPublish, PublisherID, BookCat) ' +
      'OUTPUT INSERTED.* VALUES (@isbn, @title, @yearPublish, @publisherId, @bookCat)'
    );

    const authorRequest = transaction.request();
    authorRequest.input('isbn', sql.Char(10), isbn);
    authorRequest.input('authorId', sql.SmallInt, authorId);
    await authorRequest.query(
      'INSERT INTO BookAuthor (ISBN, AuthorID) VALUES (@isbn, @authorId)'
    );

    await transaction.commit();
    res.status(201).json(bookResult.recordset[0]);
  } catch (err) {
    console.error(err);
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error(rollbackErr);
      }
    }
    res.status(500).json({ error: 'Database error' });
  } finally {
    if (connection) await connection.close();
  }
});

// GET one copy of a book
app.get('/books/:isbn/copies/:copyNo', async (req, res) => {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input('isbn', sql.Char(10), req.params.isbn);
    request.input('copyNo', sql.TinyInt, req.params.copyNo);
    const result = await request.query(
      'SELECT ISBN, CopyNo, RentalRate, Status FROM BookCopy ' +
      'WHERE ISBN = @isbn AND CopyNo = @copyNo'
    );
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.status(200).json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    if (connection) await connection.close();
  }
});

// PUT: change one copy's rental rate
app.put('/books/:isbn/copies/:copyNo', async (req, res) => {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input('isbn', sql.Char(10), req.params.isbn);
    request.input('copyNo', sql.TinyInt, req.params.copyNo);
    request.input('rentalRate', sql.SmallMoney, req.body.rentalRate);
    const result = await request.query(
      'UPDATE BookCopy SET RentalRate = @rentalRate OUTPUT INSERTED.* ' +
      'WHERE ISBN = @isbn AND CopyNo = @copyNo'
    );
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.status(200).json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    if (connection) await connection.close();
  }
});

// DELETE one copy of a book
app.delete('/books/:isbn/copies/:copyNo', async (req, res) => {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input('isbn', sql.Char(10), req.params.isbn);
    request.input('copyNo', sql.TinyInt, req.params.copyNo);
    const result = await request.query(
      'DELETE FROM BookCopy WHERE ISBN = @isbn AND CopyNo = @copyNo'
    );
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
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

