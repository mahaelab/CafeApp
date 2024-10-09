const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const app = express();
const session = require('express-session');

// serves files
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'yourSecretKey',  // secret key for encryption
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// db connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Xpure143',
  database: 'cafe_app'
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err.stack);
    return;
  }
  console.log('Connected to the MySQL database.');
});

// serve landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// user sign up route
app.post('/signup', async (req, res) => {
  console.log('Sign-up request received');
  console.log('Request body:', req.body);

  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).send('All fields are required.');
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
        'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
        [name, email, hashedPassword],
        (err, result) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Error signing up');
          }
          console.log('User inserted into database:', result);
          return res.status(201).send('User registered successfully');
        }
    );
  } catch (error) {
    console.error('Error during sign-up:', error);
    return res.status(500).send('Internal server error');
  }
});


// user login route
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send('Both email and password are required.');
  }

  //check if user exists
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) {
      console.error('Error fetching user from database:', err);
      return res.status(500).send('Error logging in');
    }

    if (results.length === 0) {
      return res.status(401).send('User not found');
    }

    const user = results[0];

    // compare hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      req.session.user = { id: user.id, name: user.name };
      res.json({ success: true, user: { name: user.name } });
    } else {
      res.json({ success: false, message: 'Invalid credentials' });
    }
  });
});

// cancel subscription
app.post('/opt-out', (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).send('User ID is required to opt-out.');
  }

  db.query('UPDATE users SET opt_out = 1 WHERE id = ?', [userId], (err, result) => {
    if (err) {
      console.error('Error opting out:', err);
      return res.status(500).send('Error opting out');
    }
    res.send('You have successfully opted out of emails.');
  });
});

// tests the database connection
app.get('/test-db', (req, res) => {
  db.query('SELECT 1 + 1 AS result', (err, results) => {
    if (err) {
      res.status(500).send('Error connecting to the database');
      console.error(err);
    } else {
      res.send(`Database connection successful: ${results[0].result}`);
    }
  });
});

// user logout route
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Error logging out');
    }
    res.send('Logged out successfully');
  });
});


// starts server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
