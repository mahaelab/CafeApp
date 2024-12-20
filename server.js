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

// session config 30 min timeout
app.use(session({
    secret: 'secretkey',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        maxAge: 1800000 // 30 minutes in milliseconds
    }
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

app.locals.db = db; // expose db for use in tests

// serve landing page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// user sign up route
app.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'all fields are required.' });
    }

    try {
        db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
            if (err) {
                console.error('database error during email check:', err);
                return res.status(500).json({ success: false, message: 'an error occurred. please try again.' });
            }

            if (results.length > 0) {
                return res.status(409).json({ success: false, message: 'email already exists.' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            db.query(
                'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
                [name, email, hashedPassword],
                (err, result) => {
                    if (err) {
                        console.error('database error during user creation:', err);
                        return res.status(500).json({ success: false, message: 'could not create account. please try again.' });
                    }
                    console.log('user inserted into database:', result);
                    req.session.user = { id: result.insertId, name };
                    return res.status(201).json({ success: true, message: 'user registered successfully.' });
                }
            );
        });
    } catch (error) {
        console.error('error during sign-up:', error);
        return res.status(500).json({ success: false, message: 'an unexpected error occurred.' });
    }
});


// user login route
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Both email and password are required.' });
    }

    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) {
            console.error('Error fetching user from database:', err);
            return res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Email does not exist.' });
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid password. Please try again.' });
        }

        req.session.user = { id: user.id, name: user.name };

        return res.json({ success: true, user: { name: user.name }, redirect: '/' });
    });
});





// user join route
app.post('/join', async (req, res) => {
    console.log('Join request received');
    console.log('Request body:', req.body);

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    try {
        db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ success: false, message: 'Error checking email' });
            }

            if (results.length > 0) {
                console.log('Duplicate email detected');
                return res.status(409).json({ success: false, message: 'Email already exists' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            db.query(
                'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
                [name, email, hashedPassword],
                (err, result) => {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ success: false, message: 'Error registering user' });
                    }
                    console.log('User inserted into database:', result);

                    req.session.user = { id: result.insertId, name };
                    return res.status(201).json({ success: true, message: 'User registered successfully', user: { name } });
                }
            );
        });
    } catch (error) {
        console.error('Error during join request:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// user profile route
app.get('/profile', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ success: false, message: 'unauthorized access.' });
    }

    const userId = req.session.user.id;
    db.query('SELECT name, email FROM users WHERE id = ?', [userId], (err, results) => {
        if (err) {
            console.error('error fetching profile:', err);
            return res.status(500).json({ success: false, message: 'an error occurred while retrieving profile.' });
        }

        if (results.length > 0) {
            res.json({ success: true, user: results[0] });
        } else {
            res.status(404).json({ success: false, message: 'user not found.' });
        }
    });
});


// database connection test
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
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error logging out' });
        }
        res.json({ success: true });
    });
});

// exports  app for testing
module.exports = app;

// starts server
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}
