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
        // checks if email exists
        db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Internal server error');
            }

            if (results.length > 0) {
                // duplicate email message
                console.error('Duplicate email detected');
                return res.status(409).json({ message: 'Email already exists' });
            }

            // hash password and inserts new user
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
                    return res.status(201).json({ success: true, message: 'User registered successfully' });
                }
            );
        });
    } catch (error) {
        console.error('Error during sign-up:', error);
        return res.status(500).send('Internal server error');
    }
});

// user login route
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Both email and password are required.' });
    }

    // checks if user exists
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) {
            console.error('Error fetching user from database:', err);
            return res.status(500).json({ message: 'Error logging in' });
        }

        if (results.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }

        const user = results[0];

        // compares hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            req.session.user = { id: user.id, name: user.name };
            res.json({ success: true, user: { name: user.name } });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    });
});

// user join route - same as signup for consistency
app.post('/join', async (req, res) => {
    console.log('Join request received');
    console.log('Request body:', req.body);

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    try {
        // checks if email already exists
        db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ success: false, message: 'Error checking email' });
            }

            if (results.length > 0) {
                console.log('Duplicate email detected');
                return res.status(409).json({ success: false, message: 'Email already exists' });
            }

            // hash password and insert new user
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

                    // Automatically log the user in after registration
                    req.session.user = { id: result.insertId, name: name };
                    return res.status(201).json({ success: true, message: 'User registered successfully', user: { name } });
                }
            );
        });
    } catch (error) {
        console.error('Error during join request:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// cancel subscription
app.post('/opt-out', (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ success: false, message: 'User ID is required to opt-out.' });
    }

    db.query('UPDATE users SET opt_out = 1 WHERE id = ?', [userId], (err, result) => {
        if (err) {
            console.error('Error opting out:', err);
            return res.status(500).json({ success: false, message: 'Error opting out' });
        }
        res.json({ success: true, message: 'You have successfully opted out of emails.' });
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
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error logging out' });
        }
        res.json({ success: true });
    });
});

// Export the app for testing purposes
module.exports = app;

// starts server
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}
