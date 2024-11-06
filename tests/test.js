const request = require('supertest');
const app = require('../server.js');
const mysql = require('mysql2');

// db connection for cleanup
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Xpure143',
    database: 'cafe_app'
});

const testEmails = [
    'integrationuser@example.com',
    'sessionuser@example.com',
    'consistentuser@example.com',
    'validuser@example.com',
    'loginuser@example.com'
];

describe('API Endpoint Checks', () => {
    afterEach(async () => {
        await request(app).post('/logout');
    });

    afterAll(async () => {
        // cleanup: delete test users by email
        for (const email of testEmails) {
            await new Promise((resolve, reject) => {
                db.query('DELETE FROM users WHERE email = ?', [email], (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        }
        db.end(); // close db connection
    });

    it('GET / should return the landing page with status 200', async () => {
        const res = await request(app).get('/');
        expect(res.statusCode).toBe(200);
    });

    it('Full signup and login flow should work', async () => {
        const signupRes = await request(app)
            .post('/signup')
            .send({
                name: 'IntegrationUser',
                email: 'integrationuser@example.com',
                password: 'IntegrationPass123'
            });
        expect(signupRes.statusCode).toBe(201);

        const loginRes = await request(app)
            .post('/login')
            .send({
                email: 'integrationuser@example.com',
                password: 'IntegrationPass123'
            });
        expect(loginRes.statusCode).toBe(200);
        expect(loginRes.body.success).toBe(true);
    });

    it('Should maintain session after login', async () => {
        await request(app)
            .post('/signup')
            .send({
                name: 'SessionUser',
                email: 'sessionuser@example.com',
                password: 'SessionPass123'
            });

        const loginRes = await request(app)
            .post('/login')
            .send({
                email: 'sessionuser@example.com',
                password: 'SessionPass123'
            });
        expect(loginRes.statusCode).toBe(200);

        // check session with profile route
        const profileRes = await request(app).get('/profile').set('Cookie', loginRes.headers['set-cookie']);
        expect(profileRes.statusCode).toBe(200);
        expect(profileRes.body.user).toBeDefined();
    });

    it('Signup, login, and retrieve profile for data consistency', async () => {
        await request(app)
            .post('/signup')
            .send({
                name: 'ConsistentUser',
                email: 'consistentuser@example.com',
                password: 'ConsistentPass123'
            });

        const loginRes = await request(app)
            .post('/login')
            .send({
                email: 'consistentuser@example.com',
                password: 'ConsistentPass123'
            });
        expect(loginRes.statusCode).toBe(200);

        // fetch profile data
        const profileRes = await request(app).get('/profile').set('Cookie', loginRes.headers['set-cookie']);
        expect(profileRes.statusCode).toBe(200);
        expect(profileRes.body.user).toBeDefined();
        expect(profileRes.body.user.email).toBe('consistentuser@example.com');
    });

    it('POST /signup should create a new user with valid data and return 201 on success', async () => {
        const res = await request(app)
            .post('/signup')
            .send({
                name: 'ValidUser',
                email: 'validuser@example.com',
                password: 'ValidPassword123'
            });
        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('User registered successfully');
    });

    it('POST /login should authenticate user with valid credentials and return 200', async () => {
        await request(app)
            .post('/signup')
            .send({
                name: 'LoginUser',
                email: 'loginuser@example.com',
                password: 'ValidPassword123'
            });

        const res = await request(app)
            .post('/login')
            .send({
                email: 'loginuser@example.com',
                password: 'ValidPassword123'
            });
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('GET /test-db should confirm database connection and return status 200', async () => {
        const res = await request(app).get('/test-db');
        expect(res.statusCode).toBe(200);
    });

    it('POST /logout should end user session and return 200 on success', async () => {
        const res = await request(app).post('/logout');
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
